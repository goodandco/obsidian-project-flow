import { ItemView, WorkspaceLeaf } from "obsidian";
import type { ProjectFlowPlugin } from "../plugin";
import type { ChatMessage, ToolCall } from "./types";
import { createToolRegistry, loadMcpToolRegistry } from "./tool-registry";
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
  private conversation: ChatMessage[] = [];
  private persistTimer: number | null = null;
  private pendingPlan: any = null;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectFlowPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.pendingPlan = this.plugin.settings.ai?.pendingPlan || null;
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
    const clearBtn = header.createEl("button", { text: "Clear" });
    clearBtn.addClass("pf-ai-clear");
    clearBtn.onclick = () => this.clearConversation();

    const list = root.createDiv({ cls: "pf-ai-messages" });
    this.messageContainer = list;
    this.conversation = (this.plugin.settings.ai?.conversation || []) as ChatMessage[];
    this.pendingPlan = this.plugin.settings.ai?.pendingPlan || null;

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
    this.flushConversation();
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
      if (this.pendingPlan) {
        await this.handleFollowup(input);
      } else {
        await this.handleNewRequest(input);
      }
    } catch (err: any) {
      this.appendMessage("assistant", err?.message || "LLM request failed.");
    } finally {
      this.busy = false;
      if (this.sendBtn) this.sendBtn.disabled = false;
    }
  }

  private async handleNewRequest(input: string): Promise<void> {
    const tools = createToolRegistry(this.plugin);
    const mcpTools = await loadMcpToolRegistry(this.plugin);
    const allTools = [...tools, ...mcpTools];
    const safeTools = filterSafeTools(allTools);
    const systemMessage = await this.buildSystemPrompt();
    const userMessage = this.buildUserMessage(input);
    const history = this.getConversationWindow().filter((m) => m.role !== "tool");
    const messages: ChatMessage[] = [
      { role: "system", content: systemMessage },
      ...history,
      { role: "user", content: userMessage },
    ];
    this.recordConversation({ role: "user", content: input });

    const planResult = await this.runPlanningStage(messages, safeTools);
    if (planResult.needsFollowup && planResult.question) {
      this.pendingPlan = {
        originalInput: input,
        plan: planResult.plan,
        context: planResult.context,
        question: planResult.question,
        fields: planResult.fields,
        createdAt: new Date().toISOString(),
        status: "clarifying",
        clarifications: [],
      };
      this.persistPendingPlan();
      this.appendMessage("assistant", planResult.question);
      this.recordConversation({ role: "assistant", content: planResult.question });
      return;
    }

    const planContext = planResult.plan ? `Planned steps: ${planResult.plan}` : "";
    const plannerNote = planResult.context ? `Planner context: ${planResult.context}` : "";
    const fieldsNote = planResult.fields && Object.keys(planResult.fields).length > 0
      ? `Fields: ${JSON.stringify(planResult.fields)}`
      : "";
    const planMessage = [planContext, plannerNote, fieldsNote].filter(Boolean).join("\n");
    if (planMessage) {
      this.appendMessage("assistant", planMessage);
      this.recordConversation({ role: "assistant", content: planMessage });
    }
    this.pendingPlan = {
      originalInput: input,
      plan: planResult.plan,
      context: planResult.context,
      fields: planResult.fields,
      createdAt: new Date().toISOString(),
      status: "awaiting_confirmation",
      clarifications: [],
    };
    this.persistPendingPlan();
    this.appendConfirmationActions();
    const confirmMsg = "Please confirm to proceed with these actions.";
    this.appendMessage("assistant", confirmMsg);
    this.recordConversation({ role: "assistant", content: confirmMsg });
  }

  private async handleFollowup(input: string): Promise<void> {
    const pending = this.pendingPlan;
    if (!pending) return;
    this.recordConversation({ role: "user", content: input });

    const tools = createToolRegistry(this.plugin);
    const mcpTools = await loadMcpToolRegistry(this.plugin);
    const allTools = [...tools, ...mcpTools];
    if (pending.status === "awaiting_confirmation") {
      if (isAffirmative(input)) {
        const systemMessage = await this.buildSystemPrompt();
        const history = this.getConversationWindow().filter((m) => m.role !== "tool");
        const followupMessage = [
          `Original request: ${pending.originalInput}`,
          pending.plan ? `Plan: ${pending.plan}` : "",
          pending.context ? `Context: ${pending.context}` : "",
          pending.fields ? `Fields: ${JSON.stringify(pending.fields)}` : "",
          pending.clarifications && pending.clarifications.length > 0
            ? `Clarifications: ${pending.clarifications.join(" | ")}`
            : "",
          "User confirmed to proceed.",
        ].filter(Boolean).join("\n");
        const messages: ChatMessage[] = [
          { role: "system", content: systemMessage },
          ...history,
          { role: "user", content: followupMessage },
        ];
        this.pendingPlan = null;
        this.persistPendingPlan();
        await this.runAgentLoop(messages, allTools);
        return;
      }
      if (isNegative(input)) {
        this.pendingPlan = null;
        this.persistPendingPlan();
        this.appendMessage("assistant", "Cancelled. Tell me if you want to try a different action.");
        this.recordConversation({ role: "assistant", content: "Cancelled. Tell me if you want to try a different action." });
        return;
      }
      this.appendConfirmationActions();
      this.appendMessage("assistant", "Please confirm to proceed with these actions.");
      this.recordConversation({ role: "assistant", content: "Please confirm to proceed with these actions." });
      return;
    }

    const safeTools = filterSafeTools(allTools);
    const systemMessage = await this.buildSystemPrompt();
    const history = this.getConversationWindow().filter((m) => m.role !== "tool");
    const clarificationContext = pending.clarifications || [];
    clarificationContext.push(input);
    pending.clarifications = clarificationContext;
    const followupMessage = [
      `Original request: ${pending.originalInput}`,
      pending.plan ? `Plan so far: ${pending.plan}` : "",
      pending.context ? `Context so far: ${pending.context}` : "",
      `User clarification: ${input}`,
    ].filter(Boolean).join("\n");
    const messages: ChatMessage[] = [
      { role: "system", content: systemMessage },
      ...history,
      { role: "user", content: followupMessage },
    ];

    const planResult = await this.runPlanningStage(messages, safeTools);
    if (planResult.needsFollowup && planResult.question) {
      pending.plan = planResult.plan;
      pending.context = planResult.context;
      pending.question = planResult.question;
      pending.fields = planResult.fields;
      pending.status = "clarifying";
      this.pendingPlan = pending;
      this.persistPendingPlan();
      this.appendMessage("assistant", planResult.question);
      this.recordConversation({ role: "assistant", content: planResult.question });
      return;
    }

    pending.plan = planResult.plan;
    pending.context = planResult.context;
    pending.fields = planResult.fields;
    pending.status = "awaiting_confirmation";
    this.pendingPlan = pending;
    this.persistPendingPlan();
    const planContext = planResult.plan ? `Planned steps: ${planResult.plan}` : "";
    const plannerNote = planResult.context ? `Planner context: ${planResult.context}` : "";
    const fieldsNote = planResult.fields && Object.keys(planResult.fields).length > 0
      ? `Fields: ${JSON.stringify(planResult.fields)}`
      : "";
    const planMessage = [planContext, plannerNote, fieldsNote].filter(Boolean).join("\n");
    if (planMessage) {
      this.appendMessage("assistant", planMessage);
      this.recordConversation({ role: "assistant", content: planMessage });
    }
    this.appendConfirmationActions();
    const confirmMsg = "Please confirm to proceed with these actions.";
    this.appendMessage("assistant", confirmMsg);
    this.recordConversation({ role: "assistant", content: confirmMsg });
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
      const strict = Boolean(this.plugin.settings.ai?.strictExecution);
      const maxRetries = 2;
      let attempt = 0;

      /* eslint-disable no-constant-condition */
      while (true) {
        try {
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
          break;
        } catch (err: any) {
          attempt += 1;
          if (attempt > maxRetries) {
            throw err;
          }
          this.appendMessage("tool", `Retrying LLM request (${attempt}/${maxRetries})...`);
          await delay(300 * attempt);
        }
      }

      const toolCalls = finalizeToolCalls(toolCallsAccumulator);
      const assistantContent = assistantEl?.textContent || "";
      messages.push({ role: "assistant", content: assistantContent, toolCalls });
      this.recordConversation({ role: "assistant", content: assistantContent });

      if (toolCalls.length === 0) {
        return;
      }

      for (const call of toolCalls) {
        this.appendMessage("tool", `Tool call: ${call.name} ${formatResult(call.arguments)}`);
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
        this.recordConversation({
          role: "tool",
          name: res.toolName,
          toolCallId: toolCalls[i]?.id,
          content: JSON.stringify(payload),
        });
        this.recordToolLog(res.toolName, res.ok, res.error);
        messages.push({
          role: "tool",
          name: res.toolName,
          toolCallId: toolCalls[i]?.id,
          content: JSON.stringify(payload),
        });
      }
      if (strict && results.some((r) => !r.ok)) {
        this.appendMessage("assistant", "Strict mode: tool execution failed. Please adjust input and try again.");
        return;
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
      "Use camelCase fields in createEntity (e.g., fields.title, fields.description).",
      "Example tool call: createEntity { projectRef:{tag:\"my-tag\"}, entityTypeId:\"task\", fields:{ title:\"...\", description:\"...\" } }",
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

  private getConversationWindow(): ChatMessage[] {
    const limit = Math.max(0, this.plugin.settings.ai?.memoryLimit ?? 10);
    if (limit === 0) return [];
    return this.conversation.slice(-limit);
  }

  private recordConversation(message: ChatMessage) {
    this.conversation.push({
      role: message.role,
      content: message.content,
      name: message.name,
      toolCallId: message.toolCallId,
    });
    const limit = Math.max(0, this.plugin.settings.ai?.memoryLimit ?? 10);
    if (limit > 0 && this.conversation.length > limit) {
      this.conversation = this.conversation.slice(-limit);
    }
    this.persistConversation();
  }

  private persistConversation() {
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(async () => {
      if (!this.plugin.settings.ai) return;
      this.plugin.settings.ai.conversation = this.conversation.map((m) => ({
        role: m.role,
        content: m.content,
        name: m.name,
        toolCallId: m.toolCallId,
      }));
      await this.plugin.saveSettings();
    }, 400);
  }

  private flushConversation() {
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.plugin.settings.ai) return;
    this.plugin.settings.ai.conversation = this.conversation.map((m) => ({
      role: m.role,
      content: m.content,
      name: m.name,
      toolCallId: m.toolCallId,
    }));
    void this.plugin.saveSettings();
  }

  private recordToolLog(toolName: string, ok: boolean, error?: string) {
    if (!this.plugin.settings.ai) return;
    const log = this.plugin.settings.ai.toolLog || [];
    log.push({ ts: new Date().toISOString(), toolName, ok, error });
    const trimmed = log.slice(-200);
    this.plugin.settings.ai.toolLog = trimmed;
    void this.plugin.saveSettings();
  }

  private clearConversation() {
    this.conversation = [];
    this.pendingPlan = null;
    if (this.messageContainer) {
      this.messageContainer.empty();
    }
    if (this.plugin.settings.ai) {
      this.plugin.settings.ai.conversation = [];
      this.plugin.settings.ai.pendingPlan = null;
      void this.plugin.saveSettings();
    }
    this.appendMessage("assistant", "Conversation cleared.");
  }

  private appendConfirmationActions() {
    if (!this.messageContainer) return;
    const wrap = this.messageContainer.createDiv({ cls: "pf-ai-confirmation" });
    const proceed = wrap.createEl("button", { text: "Proceed" });
    proceed.addClass("pf-ai-confirm");
    const reject = wrap.createEl("button", { text: "Reject" });
    reject.addClass("pf-ai-reject");
    proceed.onclick = () => this.handleFollowup("yes");
    reject.onclick = () => this.handleFollowup("no");
    this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
  }

  private async runPlanningStage(messages: ChatMessage[], tools: ReturnType<typeof createToolRegistry>): Promise<{
    needsFollowup: boolean;
    question?: string;
    plan?: string;
    context?: string;
    fields?: Record<string, string>;
  }> {
    const planningPrompt = [
      "You are a planner for ProjectFlow AI.",
      "Return ONLY valid JSON with keys: needsFollowup (boolean), question (string), plan (string), context (string), fields (object).",
      "fields must include required values for createEntity/createProject when applicable (e.g., TITLE, DESCRIPTION).",
      "If you need more info, set needsFollowup=true and ask a concise question.",
      "If you have enough info, set needsFollowup=false and provide a short plan, context summary, and fields.",
      "Do NOT call tools in this stage.",
    ].join("\n");
    const planningMessages: ChatMessage[] = [
      { role: "system", content: planningPrompt },
      ...messages.filter((m) => m.role !== "tool"),
    ];

    const content = await runPlannerLoop(planningMessages, tools, this.plugin);
    const parsed = parsePlannerJson(content);
    if (!parsed) {
      return {
        needsFollowup: false,
        plan: "",
        context: "",
        fields: {},
      };
    }
    return parsed;
  }

  private persistPendingPlan() {
    if (!this.plugin.settings.ai) return;
    this.plugin.settings.ai.pendingPlan = this.pendingPlan;
    void this.plugin.saveSettings();
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPlannerLoop(
  messages: ChatMessage[],
  tools: ReturnType<typeof createToolRegistry>,
  plugin: ProjectFlowPlugin,
): Promise<string> {
  let content = "";
  const maxSteps = 6;
  for (let step = 0; step < maxSteps; step += 1) {
    const toolCallsAccumulator = new Map<number, ToolCall>();
    content = "";
    for await (const evt of streamProvider(plugin.settings.ai!, messages, tools)) {
      if (evt.type === "content" && evt.delta) {
        content += evt.delta;
      }
      if (evt.type === "tool_call_delta" && evt.toolCalls) {
        buildToolCallsFromDeltas(evt.toolCalls, toolCallsAccumulator);
      }
    }
    const toolCalls = finalizeToolCalls(toolCallsAccumulator);
    messages.push({ role: "assistant", content, toolCalls });
    if (toolCalls.length === 0) {
      return content.trim();
    }
    const results = await executeToolCalls(toolCalls, tools);
    for (let i = 0; i < results.length; i += 1) {
      const res = results[i];
      const payload = res.ok
        ? { ok: true, result: res.result }
        : { ok: false, error: res.error };
      messages.push({
        role: "tool",
        name: res.toolName,
        toolCallId: toolCalls[i]?.id,
        content: JSON.stringify(payload),
      });
    }
  }
  return content.trim();
}

function parsePlannerJson(raw: string): {
  needsFollowup: boolean;
  question?: string;
  plan?: string;
  context?: string;
  fields?: Record<string, string>;
} | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = raw.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    const fields = obj.fields && typeof obj.fields === "object" ? obj.fields : {};
    return {
      needsFollowup: Boolean(obj.needsFollowup),
      question: typeof obj.question === "string" ? obj.question : "",
      plan: typeof obj.plan === "string" ? obj.plan : "",
      context: typeof obj.context === "string" ? obj.context : "",
      fields,
    };
  } catch {
    return null;
  }
}

function filterSafeTools(tools: ReturnType<typeof createToolRegistry>): ReturnType<typeof createToolRegistry> {
  const safeNames = new Set([
    "resolveProject",
    "listProjects",
    "listEntityTypes",
    "describeEntityType",
    "listProjectTypes",
    "describeProjectType",
    "getChildren",
    "getParents",
  ]);
  return tools.filter((t) => safeNames.has(t.name) || t.name.includes(":"));
}

function isAffirmative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["yes", "y", "confirm", "ok", "okay", "proceed"].includes(normalized);
}

function isNegative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["no", "n", "cancel", "stop"].includes(normalized);
}
