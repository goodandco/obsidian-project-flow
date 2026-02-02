import { ItemView, WorkspaceLeaf, MarkdownRenderer, setIcon } from "obsidian";
import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatMessage, ChatRole } from "../types/core";
import type { ChatUi, MessageHandle } from "../types/ui";
import { AiChatController } from "../handlers/chat";
import { AiStateStore } from "../domain/conversation";

export const AI_VIEW_TYPE = "projectflow-ai-chat";

export class ProjectFlowAIChatView extends ItemView implements ChatUi {
  plugin: ProjectFlowPlugin;
  private messageContainer: HTMLDivElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private conversationListEl: HTMLDivElement | null = null;
  private headerTitleEl: HTMLHeadingElement | null = null;
  private controller: AiChatController | null = null;
  private state: AiStateStore | null = null;
  private shellEl: HTMLDivElement | null = null;
  private sidebarEl: HTMLDivElement | null = null;
  private sidebarToggleBtn: HTMLButtonElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isNarrow = false;
  private sidebarVisible = true;
  private readonly emptyConversationTitle = "New chat";

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

    const shell = root.createDiv({ cls: "pf-ai-shell" });
    this.shellEl = shell;

    const sidebar = shell.createDiv({ cls: "pf-ai-sidebar" });
    this.sidebarEl = sidebar;
    const convHeader = sidebar.createDiv({ cls: "pf-ai-conv-header" });
    convHeader.createEl("h4", { text: "Conversations" });
    const newBtn = convHeader.createEl("button");
    newBtn.addClass("pf-ai-new");
    newBtn.setAttr("aria-label", "New conversation");
    newBtn.setAttr("title", "New conversation");
    setIcon(newBtn, "plus");
    newBtn.onclick = () => this.handleNewConversation();
    this.conversationListEl = sidebar.createDiv({ cls: "pf-ai-conv-list" });

    const main = shell.createDiv({ cls: "pf-ai-main" });

    const header = main.createDiv({ cls: "pf-ai-header" });
    const headerLeft = header.createDiv({ cls: "pf-ai-header-left" });
    const toggleBtn = headerLeft.createEl("button");
    toggleBtn.addClass("pf-ai-sidebar-toggle");
    toggleBtn.setAttr("aria-label", "Show conversations");
    toggleBtn.setAttr("title", "Show conversations");
    setIcon(toggleBtn, "arrow-left");
    toggleBtn.onclick = () => this.toggleSidebarVisibility();
    this.sidebarToggleBtn = toggleBtn;
    this.headerTitleEl = headerLeft.createEl("h3");
    const clearBtn = header.createEl("button", { text: "Clear" });
    clearBtn.addClass("pf-ai-clear");
    clearBtn.onclick = () => {
      this.controller?.clearConversation();
      this.renderConversationList();
      this.updateHeaderTitle();
    };

    const list = main.createDiv({ cls: "pf-ai-messages" });
    this.messageContainer = list;

    const inputWrap = main.createDiv({ cls: "pf-ai-input" });
    const textarea = inputWrap.createEl("textarea");
    textarea.placeholder = "Ask ProjectFlow...";
    const sendBtn = inputWrap.createEl("button", { text: "Send" });
    const statusEl = inputWrap.createDiv({ cls: "pf-ai-status" });
    statusEl.setText("");
    statusEl.style.display = "none";

    this.inputEl = textarea;
    this.sendBtn = sendBtn;
    this.statusEl = statusEl;

    this.state = await AiStateStore.create(this.plugin);
    this.clearEmptyActiveConversation();
    this.controller = new AiChatController(this.plugin, this, this.state);
    this.renderConversationList();
    this.renderActiveConversation();
    this.updateHeaderTitle();
    this.setupResizeObserver();
    this.applySidebarState();

    sendBtn.onclick = () => this.handleSend();
    textarea.onkeydown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        void this.handleSend();
      }
    };
  }

  async onClose(): Promise<void> {
    this.controller?.onClose();
    this.messageContainer = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.statusEl = null;
    this.conversationListEl = null;
    this.headerTitleEl = null;
    this.controller = null;
    this.state = null;
    this.shellEl = null;
    this.sidebarEl = null;
    this.sidebarToggleBtn = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  appendMessage(role: ChatRole, content: string): MessageHandle {
    if (!this.messageContainer) return null;
    const shouldScroll = this.shouldAutoScroll();
    const item = this.messageContainer.createDiv({ cls: `pf-ai-message ${role}` });
    this.renderMessage(item, content);
    if (shouldScroll) {
      this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
    }
    return item;
  }

  updateMessage(el: MessageHandle, content: string): void {
    if (!el) return;
    const shouldScroll = this.shouldAutoScroll();
    this.renderMessage(el, content);
    if (shouldScroll) {
      this.messageContainer?.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
    }
  }

  appendConfirmationActions(): void {
    if (!this.messageContainer) return;
    const shouldScroll = this.shouldAutoScroll();
    const wrap = this.messageContainer.createDiv({ cls: "pf-ai-confirmation" });
    const proceed = wrap.createEl("button", { text: "Proceed" });
    proceed.addClass("pf-ai-confirm");
    const reject = wrap.createEl("button", { text: "Reject" });
    reject.addClass("pf-ai-reject");
    const freeze = (chosen: "proceed" | "reject") => {
      proceed.disabled = true;
      reject.disabled = true;
      if (chosen === "proceed") {
        proceed.addClass("pf-ai-selected");
        proceed.setText("Proceed ✓");
      } else {
        reject.addClass("pf-ai-selected");
        reject.setText("Reject ✓");
      }
    };
    proceed.onclick = async () => {
      freeze("proceed");
      await this.controller?.handleFollowup("yes");
      this.renderConversationList();
      this.updateHeaderTitle();
    };
    reject.onclick = async () => {
      freeze("reject");
      await this.controller?.handleFollowup("no");
      this.renderConversationList();
      this.updateHeaderTitle();
    };
    if (shouldScroll) {
      this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
    }
  }

  clearMessages(): void {
    this.messageContainer?.empty();
  }

  setBusy(busy: boolean): void {
    if (this.sendBtn) this.sendBtn.disabled = busy;
    if (this.statusEl) {
      if (busy) {
        this.statusEl.setText("Thinking...");
        this.statusEl.style.display = "block";
      } else {
        this.statusEl.setText("");
        this.statusEl.style.display = "none";
      }
    }
  }

  private async handleSend(): Promise<void> {
    const input = (this.inputEl?.value || "").trim();
    if (!input) return;
    if (this.inputEl) this.inputEl.value = "";
    await this.controller?.handleSend(input);
    this.renderConversationList();
    this.updateHeaderTitle();
    this.hideSidebarIfNarrow();
  }

  private handleNewConversation(): void {
    if (!this.state) return;
    this.state.createConversation();
    this.resetController();
    this.renderConversationList();
    this.renderActiveConversation();
    this.updateHeaderTitle();
    this.hideSidebarIfNarrow();
  }

  private selectConversation(id: string): void {
    if (!this.state) return;
    if (id === this.state.getActiveConversationId()) return;
    this.state.setActiveConversation(id);
    this.resetController();
    this.renderConversationList();
    this.renderActiveConversation();
    this.updateHeaderTitle();
    this.hideSidebarIfNarrow();
  }

  private handleRenameConversation(id: string): void {
    if (!this.state) return;
    const current = this.state.getConversationSummaries().find((c) => c.id === id)?.title || "";
    const next = window.prompt("Rename conversation", current)?.trim();
    if (!next) return;
    this.state.renameConversation(id, next);
    this.renderConversationList();
    this.updateHeaderTitle();
  }

  private handleRemoveConversation(id: string): void {
    if (!this.state) return;
    if (!window.confirm("Remove this conversation?")) return;
    this.state.removeConversation(id);
    this.resetController();
    this.renderConversationList();
    this.renderActiveConversation();
    this.updateHeaderTitle();
    if (this.isNarrow && !this.hasActiveConversation()) {
      this.sidebarVisible = true;
    }
    this.applySidebarState();
  }

  private resetController(): void {
    if (!this.state) return;
    this.controller?.onClose();
    this.controller = new AiChatController(this.plugin, this, this.state);
  }

  private renderConversationList(): void {
    if (!this.conversationListEl || !this.state) return;
    const list = this.conversationListEl;
    list.empty();
    const conversations = this.state.getConversationSummaries();
    const activeId = this.state.getActiveConversationId();
    const visibleConversations = conversations.filter(
      (c) => !(c.messageCount === 0 && c.title === this.emptyConversationTitle),
    );
    if (conversations.length === 0) {
      list.createDiv({
        cls: "pf-ai-conv-empty",
        text: "You don't have chats yet. Press + to create one.",
      });
      return;
    }
    if (visibleConversations.length === 0) {
      list.createDiv({
        cls: "pf-ai-conv-empty",
        text: "You don't have chats yet. Press + to create one.",
      });
      return;
    }
    for (const conversation of visibleConversations) {
      const row = list.createDiv({ cls: "pf-ai-conv-item" });
      if (conversation.id === activeId) row.addClass("is-active");
      const title = row.createDiv({ text: conversation.title });
      title.addClass("pf-ai-conv-title");
      row.onclick = () => this.selectConversation(conversation.id);
      const actions = row.createDiv({ cls: "pf-ai-conv-actions" });
      const renameBtn = actions.createEl("button");
      renameBtn.addClass("pf-ai-conv-rename");
      renameBtn.setAttr("aria-label", "Rename conversation");
      renameBtn.setAttr("title", "Rename conversation");
      setIcon(renameBtn, "pencil");
      renameBtn.onclick = (ev) => {
        ev.stopPropagation();
        this.handleRenameConversation(conversation.id);
      };
      const removeBtn = actions.createEl("button");
      removeBtn.addClass("pf-ai-conv-remove");
      removeBtn.setAttr("aria-label", "Remove conversation");
      removeBtn.setAttr("title", "Remove conversation");
      setIcon(removeBtn, "trash");
      removeBtn.onclick = (ev) => {
        ev.stopPropagation();
        this.handleRemoveConversation(conversation.id);
      };
    }
  }

  private renderActiveConversation(): void {
    if (!this.state) return;
    const messages = this.state.getActiveConversationMessages();
    this.renderConversationMessages(messages);
  }

  private renderConversationMessages(messages: ChatMessage[]): void {
    if (!this.messageContainer) return;
    this.messageContainer.empty();
    for (const message of messages) {
      const item = this.messageContainer.createDiv({ cls: `pf-ai-message ${message.role}` });
      this.renderMessage(item, message.content);
    }
    this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight });
  }

  private updateHeaderTitle(): void {
    if (!this.headerTitleEl || !this.state) return;
    const title = this.state.getActiveConversationTitle();
    this.headerTitleEl.setText(title ? `ProjectFlow AI — ${title}` : "ProjectFlow AI");
  }

  private renderMessage(el: HTMLDivElement, content: string): void {
    const json = this.tryFormatJson(content);
    const markdown = json ?? content;
    el.empty();
    void MarkdownRenderer.renderMarkdown(markdown, el, "", this);
  }

  private tryFormatJson(content: string): string | null {
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
    try {
      const parsed = JSON.parse(trimmed);
      const pretty = JSON.stringify(parsed, null, 2);
      return `\`\`\`json\n${pretty}\n\`\`\``;
    } catch {
      return null;
    }
  }

  private shouldAutoScroll(): boolean {
    const container = this.messageContainer;
    if (!container) return false;
    const threshold = 24;
    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    return distanceFromBottom <= threshold;
  }

  private setupResizeObserver(): void {
    if (!this.shellEl) return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      const wasNarrow = this.isNarrow;
      this.isNarrow = width < 520;
      if (!this.isNarrow) {
        this.sidebarVisible = true;
      } else if (!wasNarrow && this.isNarrow) {
        this.sidebarVisible = !this.hasActiveConversation();
      }
      this.applySidebarState();
    });
    this.resizeObserver.observe(this.shellEl);
  }

  private toggleSidebarVisibility(): void {
    if (!this.isNarrow) return;
    this.sidebarVisible = !this.sidebarVisible;
    this.applySidebarState();
  }

  private hideSidebarIfNarrow(): void {
    if (!this.isNarrow) return;
    this.sidebarVisible = false;
    this.applySidebarState();
  }

  private applySidebarState(): void {
    const shell = this.shellEl;
    if (!shell) return;
    shell.toggleClass("pf-ai-narrow", this.isNarrow);
    shell.toggleClass("pf-ai-sidebar-hidden", this.isNarrow && !this.sidebarVisible);
    shell.toggleClass("pf-ai-sidebar-open", this.isNarrow && this.sidebarVisible);
  }

  private hasActiveConversation(): boolean {
    if (!this.state) return false;
    return Boolean(this.state.getActiveConversationId());
  }

  private clearEmptyActiveConversation(): void {
    if (!this.state) return;
    const activeId = this.state.getActiveConversationId();
    if (!activeId) return;
    const summary = this.state.getConversationSummaries().find((c) => c.id === activeId);
    if (!summary) return;
    if (summary.messageCount === 0 && summary.title === this.emptyConversationTitle) {
      this.state.clearActiveConversation();
    }
  }
}
