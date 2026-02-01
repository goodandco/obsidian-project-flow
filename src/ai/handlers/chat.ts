import type { ProjectFlowPlugin } from "../../plugin";
import type { PendingPlan } from "../../interfaces";
import type { ChatMessage } from "../types/core";
import type { ChatUi } from "../types/ui";
import { createToolRegistry, loadMcpToolRegistry } from "../adapters/registry";
import { runAgentLoop } from "./agent";
import { runPlanningStage } from "../domain/planner";
import { buildSystemPrompt, buildUserMessage } from "../domain/prompts";
import { filterSafeTools, isAffirmative, isNegative } from "../domain/safety";
import { findProjectMatches } from "../domain/context";
import type { AiStateStore } from "../domain/conversation";
import { classifyIntent } from "../domain/intent";
import { streamProvider } from "../providers/provider";

const CHAT_PROMPT = [
  "You are a helpful Obsidian assistant.",
  "Answer conversationally.",
  "Do not propose plans unless explicitly asked.",
  "Do not call tools.",
  "If the user implies possible actions, suggest them softly.",
].join("\n");

const DEFAULT_MIXED_OFFER_TEXT = "I can also set this up for you. Shall I proceed?";

export class AiChatController {
  private busy = false;
  private pendingPlan: PendingPlan | null = null;
  private pendingMixedInput: string | null = null;

  constructor(
    private plugin: ProjectFlowPlugin,
    private ui: ChatUi,
    private state: AiStateStore,
  ) {
    this.pendingPlan = this.state.getPendingPlan();
  }

  async handleSend(inputRaw: string): Promise<void> {
    if (this.busy) return;
    const input = inputRaw.trim();
    if (!input) return;

    this.ui.appendMessage("user", input);

    const aiSettings = this.plugin.settings.ai;
    if (!aiSettings?.enabled) {
      this.ui.appendMessage("assistant", "AI module is disabled in settings.");
      return;
    }

    if (!aiSettings.apiKey && aiSettings.provider !== "ollama") {
      await this.handleTagLookup(input);
      return;
    }

    await this.handleLLM(input);
  }

  onClose(): void {
    this.state.flushConversation();
  }

  clearConversation(): void {
    this.pendingPlan = null;
    this.state.clearConversation();
    this.state.setPendingPlan(null);
    this.ui.clearMessages();
    this.ui.appendMessage("assistant", "Conversation cleared.");
  }

  async handleFollowup(inputRaw: string): Promise<void> {
    const pending = this.pendingPlan;
    if (!pending) return;
    const input = inputRaw.trim();
    if (!input) return;
    this.state.appendMessage({ role: "user", content: input });

    const tools = createToolRegistry(this.plugin);
    const mcpTools = await loadMcpToolRegistry(this.plugin);
    const allTools = [...tools, ...mcpTools];

    if (pending.status === "awaiting_confirmation") {
      if (isAffirmative(input)) {
        const systemMessage = await buildSystemPrompt(this.plugin);
        const history = this.state.getConversationWindow().filter((m) => m.role !== "tool");
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
        this.setPendingPlan(null);
        await runAgentLoop({
          plugin: this.plugin,
          ui: this.ui,
          state: this.state,
          messages,
          tools: allTools,
        });
        return;
      }
      if (isNegative(input)) {
        this.setPendingPlan(null);
        this.ui.appendMessage("assistant", "Cancelled. Tell me if you want to try a different action.");
        this.state.appendMessage({
          role: "assistant",
          content: "Cancelled. Tell me if you want to try a different action.",
        });
        return;
      }
      this.ui.appendConfirmationActions();
      this.ui.appendMessage("assistant", "Please confirm to proceed with these actions.");
      this.state.appendMessage({
        role: "assistant",
        content: "Please confirm to proceed with these actions.",
      });
      return;
    }

    const safeTools = filterSafeTools(allTools);
    const systemMessage = await buildSystemPrompt(this.plugin);
    const history = this.state.getConversationWindow().filter((m) => m.role !== "tool");
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

    const planResult = await runPlanningStage({
      plugin: this.plugin,
      messages,
      tools: safeTools,
      allowToolCalls: false,
    });
    if (planResult.needsFollowup && planResult.question) {
      pending.plan = planResult.plan;
      pending.context = planResult.context;
      pending.question = planResult.question;
      pending.fields = planResult.fields;
      pending.status = "clarifying";
      this.setPendingPlan(pending);
      this.ui.appendMessage("assistant", planResult.question);
      this.state.appendMessage({ role: "assistant", content: planResult.question });
      return;
    }

    pending.plan = planResult.plan;
    pending.context = planResult.context;
    pending.fields = planResult.fields;
    pending.status = "awaiting_confirmation";
    this.setPendingPlan(pending);
    const planContext = planResult.plan ? `Planned steps: ${planResult.plan}` : "";
    const plannerNote = planResult.context ? `Planner context: ${planResult.context}` : "";
    const fieldsNote = planResult.fields && Object.keys(planResult.fields).length > 0
      ? `Fields: ${JSON.stringify(planResult.fields)}`
      : "";
    const planMessage = [planContext, plannerNote, fieldsNote].filter(Boolean).join("\n");
    if (planMessage) {
      this.ui.appendMessage("assistant", planMessage);
      this.state.appendMessage({ role: "assistant", content: planMessage });
    }
    this.ui.appendConfirmationActions();
    const confirmMsg = "Please confirm to proceed with these actions.";
    this.ui.appendMessage("assistant", confirmMsg);
    this.state.appendMessage({ role: "assistant", content: confirmMsg });
  }

  private async handleTagLookup(input: string): Promise<void> {
    const api = this.plugin.getApi();
    if (!api) {
      this.ui.appendMessage("assistant", "Core API is not available.");
      return;
    }
    try {
      const result = api.resolveProject({ tag: input });
      if (!result) {
        const matches = findProjectMatches(this.plugin, input);
        if (matches.length === 0) {
          this.ui.appendMessage("assistant", "Project not found.");
        } else if (matches.length === 1) {
          this.ui.appendMessage(
            "assistant",
            `Resolved project: ${matches[0].fullName} (${matches[0].projectTag})`,
          );
        } else {
          const list = matches.map((m) => `- ${m.projectTag} (${m.fullName})`).join("\n");
          this.ui.appendMessage("assistant", `Multiple matches found:\n${list}`);
        }
        return;
      }
      this.ui.appendMessage(
        "assistant",
        `Resolved project: ${result.entry.fullName} (${result.entry.projectTag})`,
      );
    } catch (err: any) {
      this.ui.appendMessage("assistant", err?.message || "Failed to resolve project.");
    }
  }

  private async handleLLM(input: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.ui.setBusy(true);

    try {
      if (this.pendingPlan) {
        await this.handleFollowup(input);
      } else if (this.pendingMixedInput) {
        await this.handleMixedFollowup(input);
      } else {
        await this.handleNewRequest(input);
      }
    } catch (err: any) {
      this.ui.appendMessage("assistant", err?.message || "LLM request failed.");
    } finally {
      this.busy = false;
      this.ui.setBusy(false);
    }
  }

  private async handleNewRequest(input: string): Promise<void> {
    const history = this.state.getConversationWindow().filter((m) => m.role !== "tool");
    this.state.appendMessage({ role: "user", content: input });

    const aiSettings = this.plugin.settings.ai!;
    const intentResult = await classifyIntent(input, aiSettings);
    if (intentResult.intent === "action") {
      await this.handleActionRequest(input, history);
      return;
    }
    if (intentResult.intent === "mixed") {
      await this.handleMixedRequest(input, history);
      return;
    }
    if (intentResult.intent === "unclear") {
      const prompt = "Could you clarify what you'd like me to do?";
      this.ui.appendMessage("assistant", prompt);
      this.state.appendMessage({ role: "assistant", content: prompt });
      return;
    }
    await this.handleChatRequest(input, history);
  }

  private async handleChatRequest(input: string, history: ChatMessage[]): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: CHAT_PROMPT },
      ...history,
      { role: "user", content: input },
    ];
    const assistantEl = this.ui.appendMessage("assistant", "");
    let content = "";
    for await (const evt of streamProvider(this.plugin.settings.ai!, messages, [])) {
      if (evt.type === "content" && evt.delta) {
        content += evt.delta;
        this.ui.updateMessage(assistantEl, content);
      }
    }
    if (!assistantEl) {
      this.ui.appendMessage("assistant", content);
    }
    this.state.appendMessage({ role: "assistant", content });
    return content;
  }

  private async handleActionRequest(input: string, history: ChatMessage[]): Promise<void> {
    const tools = createToolRegistry(this.plugin);
    const mcpTools = await loadMcpToolRegistry(this.plugin);
    const allTools = [...tools, ...mcpTools];
    const safeTools = filterSafeTools(allTools);
    const systemMessage = await buildSystemPrompt(this.plugin);
    const userMessage = buildUserMessage(input);
    const messages: ChatMessage[] = [
      { role: "system", content: systemMessage },
      ...history,
      { role: "user", content: userMessage },
    ];

    const planResult = await runPlanningStage({
      plugin: this.plugin,
      messages,
      tools: safeTools,
      allowToolCalls: false,
    });
    if (planResult.needsFollowup && planResult.question) {
      this.setPendingPlan({
        originalInput: input,
        plan: planResult.plan,
        context: planResult.context,
        question: planResult.question,
        fields: planResult.fields,
        createdAt: new Date().toISOString(),
        status: "clarifying",
        clarifications: [],
      });
      this.ui.appendMessage("assistant", planResult.question);
      this.state.appendMessage({ role: "assistant", content: planResult.question });
      return;
    }

    const planContext = planResult.plan ? `Planned steps: ${planResult.plan}` : "";
    const plannerNote = planResult.context ? `Planner context: ${planResult.context}` : "";
    const fieldsNote = planResult.fields && Object.keys(planResult.fields).length > 0
      ? `Fields: ${JSON.stringify(planResult.fields)}`
      : "";
    const planMessage = [planContext, plannerNote, fieldsNote].filter(Boolean).join("\n");
    if (planMessage) {
      this.ui.appendMessage("assistant", planMessage);
      this.state.appendMessage({ role: "assistant", content: planMessage });
    }
    this.setPendingPlan({
      originalInput: input,
      plan: planResult.plan,
      context: planResult.context,
      fields: planResult.fields,
      createdAt: new Date().toISOString(),
      status: "awaiting_confirmation",
      clarifications: [],
    });
    this.ui.appendConfirmationActions();
    const confirmMsg = "Please confirm to proceed with these actions.";
    this.ui.appendMessage("assistant", confirmMsg);
    this.state.appendMessage({ role: "assistant", content: confirmMsg });
  }

  private async handleMixedRequest(input: string, history: ChatMessage[]): Promise<void> {
    await this.handleChatRequest(input, history);
    const offer = this.getMixedOfferText();
    this.ui.appendMessage("assistant", offer);
    this.state.appendMessage({ role: "assistant", content: offer });
    this.pendingMixedInput = input;
  }

  private async handleMixedFollowup(input: string): Promise<void> {
    const originalInput = this.pendingMixedInput;
    if (!originalInput) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    this.state.appendMessage({ role: "user", content: trimmed });

    if (isAffirmative(trimmed)) {
      this.pendingMixedInput = null;
      const history = this.state.getConversationWindow().filter((m) => m.role !== "tool");
      await this.handleActionRequest(originalInput, history);
      return;
    }
    if (isNegative(trimmed)) {
      this.pendingMixedInput = null;
      const msg = "Okay. Let me know if you'd like me to set it up.";
      this.ui.appendMessage("assistant", msg);
      this.state.appendMessage({ role: "assistant", content: msg });
      return;
    }
    const prompt = "Please confirm if you'd like me to proceed.";
    this.ui.appendMessage("assistant", prompt);
    this.state.appendMessage({ role: "assistant", content: prompt });
  }

  private getMixedOfferText(): string {
    const text = this.plugin.settings.ai?.mixedOfferText?.trim();
    return text || DEFAULT_MIXED_OFFER_TEXT;
  }

  private setPendingPlan(pending: PendingPlan | null): void {
    this.pendingPlan = pending;
    this.state.setPendingPlan(pending);
  }
}
