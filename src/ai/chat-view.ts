import { ItemView, WorkspaceLeaf } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { ChatMessage, ToolCall } from "./types";
import { createToolRegistry } from "./tool-registry";
import { executeToolCalls } from "./agent-executor";
import { buildToolCallsFromDeltas, finalizeToolCalls } from "./openai-client";
import { streamProvider } from "./provider";
import { findProjectMatches, inferActiveProject } from "./context";

export const AI_VIEW_TYPE = "projectflow-ai-chat";

export class ProjectFlowAIChatView extends ItemView {
  plugin: ProjectFlowPlugin;
  private messageContainer: HTMLDivElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private busy = false;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return AI_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "ProjectFlow AI";
  }

  getIcon(): string {
    return "brain-circuit";
  }

  async onOpen(): Promise<void> {
    const root = this.containerEl.children[1];
    root.empty();
    root.addClass("pf-ai-view");

    const header = root.createDiv({ cls: "pf-ai-header" });
    header.createEl("h3", { text: "ProjectFlow AI" });

    const list = root.createDiv({ cls: "pf-ai-messages" });
    this.messageContainer = list;

    const inputWrap = root.createDiv({ cls: "pf-ai-input" });
    const textarea = inputWrap.createEl("textarea");
    textarea.placeholder = "Ask ProjectFlow...";
    const sendBtn = inputWrap.createEl("button", { text: "Send" });

    this.inputEl = textarea;
    this.sendBtn = sendBtn;

    sendBtn.onclick = () => this.handleSend();
    textarea.onkeydown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        this.handleSend();
      }
    };
  }

  async onClose(): Promise<void> {
    this.messageContainer = null;
    this.inputEl = null;
    this.sendBtn = null;
  }

  private appendMessage(role: ChatMessage["role"], content: string): HTMLDivElement | null {
    if (!this.messageContainer) return null;
    const item = this.messageContainer.createDiv({ cls: `pf-ai-message ${role}` });
    item.setText(content);
    this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
    return item;
  }

  private updateMessage(el: HTMLDivElement | null, content: string) {
    if (!el) return;
    el.setText(content);
    this.messageContainer?.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
  }

  private async handleSend(): Promise<void> {
    if (this.busy) return;
    const input = (this.inputEl?.value || "").trim();
    if (!input) return;
    this.inputEl!.value = "";

    this.appendMessage("user", input);

    const aiSettings = this.plugin.settings.ai;
    if (!aiSettings?.enabled) {
      this.appendMessage("assistant", "AI module is disabled in settings.");
      return;
    }

    if (!aiSettings.apiKey && aiSettings.provider !== "ollama") {
      await this.handleTagLookup(input);
      return;
    }

    await this.handleLLM(input);
  }

  private async handleTagLookup(input: string): Promise<void> {
    const api = this.plugin.getApi();
    if (!api) {
      this.appendMessage("assistant", "Core API is not available.");
      return;
    }
    try {
      const result = api.resolveProject({ tag: input });
      if (!result) {
        const matches = findProjectMatches(this.plugin, input);
        if (matches.length === 0) {
          this.appendMessage("assistant", "Project not found.");
        } else if (matches.length === 1) {
          this.appendMessage(
            "assistant",
            `Resolved project: ${matches[0].fullName} (${matches[0].projectTag})`,
          );
        } else {
          const list = matches.map((m) => `- ${m.projectTag} (${m.fullName})`).join("\\n");
          this.appendMessage("assistant", `Multiple matches found:\\n${list}`);
        }
        return;
      }
      this.appendMessage(
        "assistant",
        `Resolved project: ${result.entry.fullName} (${result.entry.projectTag})`,
      );
    } catch (err: any) {
      this.appendMessage("assistant", err?.message || "Failed to resolve project.");
    }
  }

  private async handleLLM(input: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    if (this.sendBtn) this.sendBtn.disabled = true;

    try {
      const tools = createToolRegistry(this.plugin);
      const systemMessage = await this.buildSystemPrompt();
      const userMessage = this.buildUserMessage(input);
      const messages: ChatMessage[] = [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ];

      await this.runAgentLoop(messages, tools);
    } catch (err: any) {
      this.appendMessage("assistant", err?.message || "LLM request failed.");
    } finally {
      this.busy = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
    }
  }

  private async runAgentLoop(
    messages: ChatMessage[],
    tools: ReturnType<typeof createToolRegistry>,
  ) {
    const maxSteps = 6;
    for (let step = 0; step < maxSteps; step += 1) {
      const assistantEl = this.appendMessage("assistant", "");
      const toolUsageEls = new Map<string, HTMLDivElement>();
      const toolCallsAccumulator = new Map<number, ToolCall>();

      for await (const evt of streamProvider(this.plugin.settings.ai!, messages, tools)) {
        if (evt.type === "content" && evt.delta) {
          const current = assistantEl?.textContent || "";
          this.updateMessage(assistantEl, current + evt.delta);
        }
        if (evt.type === "tool_call_delta" && evt.toolCalls) {
          buildToolCallsFromDeltas(evt.toolCalls, toolCallsAccumulator);
          for (const delta of evt.toolCalls) {
            if (!delta.name) continue;
            if (!toolUsageEls.has(delta.name)) {
              const el = this.appendMessage("tool", `Using tool: ${delta.name}`);
              if (el) toolUsageEls.set(delta.name, el);
            }
          }
        }
      }

      const toolCalls = finalizeToolCalls(toolCallsAccumulator);
      const assistantContent = assistantEl?.textContent || "";
      messages.push({ role: "assistant", content: assistantContent, toolCalls });

      if (toolCalls.length === 0) {
        return;
      }

      const results = await executeToolCalls(toolCalls, tools);
      const missingFields = extractMissingFields(results);
      for (let i = 0; i < results.length; i += 1) {
        const res = results[i];
        const payload = res.ok
          ? { ok: true, result: res.result }
          : { ok: false, error: res.error };
        const msg = res.ok
          ? `Tool result (${res.toolName}): ${formatResult(res.result)}`
          : `Tool error (${res.toolName}): ${res.error}`;
        this.appendMessage("tool", msg);
        messages.push({
          role: "tool",
          name: res.toolName,
          toolCallId: toolCalls[i]?.id,
          content: JSON.stringify(payload),
        });
      }
      if (missingFields.length > 0) {
        const unique = Array.from(new Set(missingFields));
        this.appendMessage(
          "assistant",
          `Missing required fields: ${unique.join(", ")}. Please provide them and try again.`,
        );
        return;
      }
    }
    this.appendMessage("assistant", "Stopped after reaching max tool steps.");
  }

  private async buildSystemPrompt(): Promise<string> {
    const selection = this.getSelection();
    const activeFile = this.app.workspace.getActiveFile();
    let activeFileContent = "";
    if (activeFile) {
      try {
        const raw = await this.app.vault.cachedRead(activeFile);
        activeFileContent = raw.slice(0, 1000);
      } catch {
        activeFileContent = "";
      }
    }
    const projectIndex = this.plugin.settings.projectIndex;
    const activeProject = inferActiveProject(this.plugin);
    const entityRequirements = getEntityRequirementsSummary(this.plugin);

    return [
      "You are ProjectFlow AI. You must use tools to perform any actions.",
      "Never edit markdown directly; use tools only.",
      "Respond with tool calls when an action is required.",
      "If required fields are missing, ask the user for them instead of calling tools.",
      "Map user input lines like 'title:' and 'description:' to fields.TITLE and fields.DESCRIPTION.",
      "Context:",
      `Selected text: ${selection || "(none)"}`,
      `Active file: ${activeFile?.path || "(none)"}`,
      `Active file content (truncated): ${activeFileContent || "(none)"}`,
      `Active project: ${activeProject ? `${activeProject.projectTag} (${activeProject.fullName})` : "(none)"}`,
      `Entity required fields: ${entityRequirements}`,
      `Project index snapshot: ${projectIndex ? JSON.stringify(projectIndex) : "(none)"}`,
    ].join("\n");
  }

  private buildUserMessage(input: string): string {
    return `I'm going to create a project with tag ${input}\n${input}`;
  }

  private getSelection(): string {
    const editor = (this.app.workspace as any).activeEditor?.editor;
    if (!editor) return "";
    return editor.getSelection();
  }
}

function formatResult(result: unknown): string {
  if (result == null) return "(no result)";
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function extractMissingFields(results: Array<{ ok: boolean; error?: string }>): string[] {
  const missing: string[] = [];
  for (const res of results) {
    if (!res.ok && res.error?.startsWith("Missing required fields:")) {
      const parts = res.error.split(":").slice(1).join(":").split(",");
      parts.forEach((p) => {
        const val = p.trim();
        if (val) missing.push(val);
      });
    }
  }
  return missing;
}

function getEntityRequirementsSummary(plugin: ProjectFlowPlugin): string {
  const registry = plugin.settings.entityTypes || {};
  const summary: Record<string, string[]> = {};
  for (const [id, def] of Object.entries(registry)) {
    if (def?.requiredFields && def.requiredFields.length > 0) {
      summary[id] = def.requiredFields;
    }
  }
  try {
    return JSON.stringify(summary);
  } catch {
    return "(unavailable)";
  }
}
