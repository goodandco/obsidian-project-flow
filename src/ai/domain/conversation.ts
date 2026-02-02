import type { ProjectFlowPlugin } from "../../plugin";
import type { PendingPlan } from "../../interfaces";
import type { ChatMessage, ChatRole } from "../types/core";

const DATA_FILE_NAME = "ai-conversations.json";
const SCHEMA_VERSION = 1;
const DEFAULT_CONVERSATION_TITLE = "New chat";
const MAX_TITLE_LENGTH = 60;

interface AiConversationEntry {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  pendingPlan?: PendingPlan | null;
}

interface AiConversationData {
  schemaVersion: number;
  activeConversationId?: string;
  conversations: AiConversationEntry[];
}

export interface AiConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function createConversationId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `conv_${Date.now().toString(36)}_${rand}`;
}

function normalizeTitle(raw: string | undefined | null): string {
  const trimmed = (raw || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return DEFAULT_CONVERSATION_TITLE;
  return trimmed.slice(0, MAX_TITLE_LENGTH);
}

function deriveTitleFromMessage(message: string): string {
  return normalizeTitle(message);
}

function isValidRole(role: any): role is ChatRole {
  return role === "system" || role === "user" || role === "assistant" || role === "tool";
}

export class AiStateStore {
  private data: AiConversationData = {
    schemaVersion: SCHEMA_VERSION,
    conversations: [],
  };
  private persistTimer: number | null = null;

  private constructor(private plugin: ProjectFlowPlugin) {}

  static async create(plugin: ProjectFlowPlugin): Promise<AiStateStore> {
    const store = new AiStateStore(plugin);
    await store.load();
    return store;
  }

  getConversationWindow(): ChatMessage[] {
    const limit = Math.max(0, this.plugin.settings.ai?.memoryLimit ?? 10);
    if (limit === 0) return [];
    const conversation = this.getActiveConversation();
    if (!conversation) return [];
    return conversation.messages.slice(-limit);
  }

  getActiveConversationId(): string | null {
    return this.data.activeConversationId ?? null;
  }

  getActiveConversationTitle(): string {
    return this.getActiveConversation()?.title || "";
  }

  getActiveConversationMessages(): ChatMessage[] {
    const conversation = this.getActiveConversation();
    return conversation ? conversation.messages.slice() : [];
  }

  getConversationSummaries(): AiConversationSummary[] {
    return [...this.data.conversations]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }));
  }

  createConversation(title?: string): string {
    const now = new Date().toISOString();
    const conversation: AiConversationEntry = {
      id: createConversationId(),
      title: normalizeTitle(title),
      createdAt: now,
      updatedAt: now,
      messages: [],
      pendingPlan: null,
    };
    this.data.conversations.push(conversation);
    this.data.activeConversationId = conversation.id;
    this.persistConversation();
    return conversation.id;
  }

  renameConversation(id: string, title: string): void {
    const conversation = this.data.conversations.find((c) => c.id === id);
    if (!conversation) return;
    conversation.title = normalizeTitle(title);
    conversation.updatedAt = new Date().toISOString();
    this.persistConversation();
  }

  removeConversation(id: string): void {
    const currentActive = this.data.activeConversationId;
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    if (currentActive === id) {
      const fallback = this.data.conversations[0];
      this.data.activeConversationId = fallback ? fallback.id : undefined;
    }
    this.persistConversation();
  }

  setActiveConversation(id: string): void {
    if (!this.data.conversations.some((c) => c.id === id)) return;
    this.data.activeConversationId = id;
    this.persistConversation();
  }

  clearActiveConversation(): void {
    this.data.activeConversationId = undefined;
    this.persistConversation();
  }

  appendMessage(message: ChatMessage): void {
    let conversation = this.getActiveConversation();
    if (!conversation) {
      const id = this.createConversation();
      conversation = this.getActiveConversationById(id);
      if (!conversation) return;
    }
    conversation.messages.push({
      role: message.role,
      content: message.content,
      name: message.name,
      toolCallId: message.toolCallId,
    });
    conversation.updatedAt = new Date().toISOString();
    if (conversation.title === DEFAULT_CONVERSATION_TITLE && message.role === "user") {
      conversation.title = deriveTitleFromMessage(message.content);
    }
    this.persistConversation();
  }

  clearConversation(): void {
    const conversation = this.getActiveConversation();
    if (!conversation) return;
    conversation.messages = [];
    conversation.pendingPlan = null;
    conversation.updatedAt = new Date().toISOString();
    this.persistConversation();
  }

  flushConversation(): void {
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    void this.writeNow();
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
    const conversation = this.getActiveConversation();
    return conversation?.pendingPlan || null;
  }

  setPendingPlan(pending: PendingPlan | null): void {
    const conversation = this.getActiveConversation();
    if (!conversation) return;
    conversation.pendingPlan = pending;
    conversation.updatedAt = new Date().toISOString();
    this.persistConversation();
  }

  private getActiveConversation(): AiConversationEntry | null {
    const activeId = this.data.activeConversationId;
    if (!activeId) return null;
    return this.getActiveConversationById(activeId) || null;
  }

  private getActiveConversationById(id: string): AiConversationEntry | null {
    return this.data.conversations.find((c) => c.id === id) || null;
  }

  private persistConversation(): void {
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(() => {
      void this.writeNow();
    }, 400);
  }

  private async load(): Promise<void> {
    const adapter: any = this.plugin.app.vault.adapter;
    const path = this.getDataPath();
    const exists = await adapter.exists(path);
    if (exists) {
      try {
        const raw = await adapter.read(path);
        this.data = this.normalizeData(JSON.parse(raw));
      } catch {
        this.data = { schemaVersion: SCHEMA_VERSION, conversations: [] };
      }
    }

    const legacyMessages = (this.plugin.settings.ai?.conversation || []) as ChatMessage[];
    const legacyPending = this.plugin.settings.ai?.pendingPlan ?? null;
    const shouldMigrate = this.data.conversations.length === 0 && (legacyMessages.length > 0 || legacyPending);

    if (shouldMigrate) {
      const now = new Date().toISOString();
      const migrated: AiConversationEntry = {
        id: createConversationId(),
        title: "Migrated chat",
        createdAt: now,
        updatedAt: now,
        messages: legacyMessages.map((m) => ({
          role: m.role,
          content: m.content,
          name: m.name,
          toolCallId: m.toolCallId,
        })),
        pendingPlan: legacyPending as any,
      };
      this.data.conversations.push(migrated);
      this.data.activeConversationId = migrated.id;
      await this.cleanupLegacySettings();
      await this.writeNow();
      return;
    }

    if (!this.data.activeConversationId) {
      if (this.data.conversations.length > 0) {
        this.data.activeConversationId = this.data.conversations[0].id;
      }
    }
  }

  private normalizeData(raw: any): AiConversationData {
    const data: AiConversationData = {
      schemaVersion: SCHEMA_VERSION,
      activeConversationId: typeof raw?.activeConversationId === "string" ? raw.activeConversationId : undefined,
      conversations: [],
    };
    const items = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const seen = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = typeof item.id === "string" ? item.id : createConversationId();
      if (seen.has(id)) continue;
      seen.add(id);
      const title = normalizeTitle(item.title);
      const createdAt = typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();
      const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : createdAt;
      const messages: ChatMessage[] = Array.isArray(item.messages)
        ? item.messages
          .filter((m: any) => m && typeof m.content === "string" && isValidRole(m.role))
          .map((m: any) => ({
            role: m.role,
            content: m.content,
            name: typeof m.name === "string" ? m.name : undefined,
            toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
          }))
        : [];
      const pendingPlan = item.pendingPlan ?? null;
      data.conversations.push({
        id,
        title,
        createdAt,
        updatedAt,
        messages,
        pendingPlan,
      });
    }
    return data;
  }

  private async cleanupLegacySettings(): Promise<void> {
    if (!this.plugin.settings.ai) return;
    let changed = false;
    if ((this.plugin.settings.ai as any).conversation) {
      delete (this.plugin.settings.ai as any).conversation;
      changed = true;
    }
    if ((this.plugin.settings.ai as any).pendingPlan) {
      delete (this.plugin.settings.ai as any).pendingPlan;
      changed = true;
    }
    if (changed) {
      await this.plugin.saveSettings();
    }
  }

  private async ensureDataFolder(): Promise<void> {
    const adapter: any = this.plugin.app.vault.adapter;
    const folder = this.getDataFolder();
    if (!(await adapter.exists(folder))) {
      await adapter.mkdir(folder);
    }
  }

  private async writeNow(): Promise<void> {
    try {
      await this.ensureDataFolder();
      const adapter: any = this.plugin.app.vault.adapter;
      await adapter.write(this.getDataPath(), JSON.stringify(this.data, null, 2));
    } catch {
      // ignore file system errors
    }
  }

  private getDataFolder(): string {
    const id = this.plugin.manifest?.id || "project-flow";
    return `.obsidian/plugins/${id}`;
  }

  private getDataPath(): string {
    return `${this.getDataFolder()}/${DATA_FILE_NAME}`;
  }
}
