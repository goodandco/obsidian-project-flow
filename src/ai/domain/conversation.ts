import type { ProjectFlowPlugin } from "../../plugin";
import type { PendingPlan } from "../../interfaces";
import type { ChatMessage } from "../types/core";

export class AiStateStore {
  private conversation: ChatMessage[] = [];
  private persistTimer: number | null = null;

  constructor(private plugin: ProjectFlowPlugin) {
    this.conversation = (this.plugin.settings.ai?.conversation || []) as ChatMessage[];
  }

  getConversationWindow(): ChatMessage[] {
    const limit = Math.max(0, this.plugin.settings.ai?.memoryLimit ?? 10);
    if (limit === 0) return [];
    return this.conversation.slice(-limit);
  }

  appendMessage(message: ChatMessage): void {
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

  clearConversation(): void {
    this.conversation = [];
    if (this.plugin.settings.ai) {
      this.plugin.settings.ai.conversation = [];
      void this.plugin.saveSettings();
    }
  }

  flushConversation(): void {
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

  recordToolLog(toolName: string, ok: boolean, error?: string): void {
    if (!this.plugin.settings.ai) return;
    const log = this.plugin.settings.ai.toolLog || [];
    log.push({ ts: new Date().toISOString(), toolName, ok, error });
    const trimmed = log.slice(-200);
    this.plugin.settings.ai.toolLog = trimmed;
    void this.plugin.saveSettings();
  }

  getPendingPlan(): PendingPlan | null {
    return this.plugin.settings.ai?.pendingPlan || null;
  }

  setPendingPlan(pending: PendingPlan | null): void {
    if (!this.plugin.settings.ai) return;
    this.plugin.settings.ai.pendingPlan = pending;
    void this.plugin.saveSettings();
  }

  private persistConversation(): void {
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
}
