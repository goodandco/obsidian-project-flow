import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatRole } from "../types/core";
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
  private controller: AiChatController | null = null;

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
    const clearBtn = header.createEl("button", { text: "Clear" });
    clearBtn.addClass("pf-ai-clear");
    clearBtn.onclick = () => this.controller?.clearConversation();

    const list = root.createDiv({ cls: "pf-ai-messages" });
    this.messageContainer = list;

    const inputWrap = root.createDiv({ cls: "pf-ai-input" });
    const textarea = inputWrap.createEl("textarea");
    textarea.placeholder = "Ask ProjectFlow...";
    const sendBtn = inputWrap.createEl("button", { text: "Send" });
    const statusEl = inputWrap.createDiv({ cls: "pf-ai-status" });
    statusEl.setText("");
    statusEl.style.display = "none";

    this.inputEl = textarea;
    this.sendBtn = sendBtn;
    this.statusEl = statusEl;

    const state = new AiStateStore(this.plugin);
    this.controller = new AiChatController(this.plugin, this, state);

    sendBtn.onclick = () => this.handleSend();
    textarea.onkeydown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        this.handleSend();
      }
    };
  }

  async onClose(): Promise<void> {
    this.controller?.onClose();
    this.messageContainer = null;
    this.inputEl = null;
    this.sendBtn = null;
    this.statusEl = null;
    this.controller = null;
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
    proceed.onclick = () => {
      freeze("proceed");
      this.controller?.handleFollowup("yes");
    };
    reject.onclick = () => {
      freeze("reject");
      this.controller?.handleFollowup("no");
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
}
