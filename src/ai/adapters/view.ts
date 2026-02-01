import { ItemView, WorkspaceLeaf } from "obsidian";
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

    this.inputEl = textarea;
    this.sendBtn = sendBtn;

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
    this.controller = null;
  }

  appendMessage(role: ChatRole, content: string): MessageHandle {
    if (!this.messageContainer) return null;
    const item = this.messageContainer.createDiv({ cls: `pf-ai-message ${role}` });
    item.setText(content);
    this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
    return item;
  }

  updateMessage(el: MessageHandle, content: string): void {
    if (!el) return;
    el.setText(content);
    this.messageContainer?.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
  }

  appendConfirmationActions(): void {
    if (!this.messageContainer) return;
    const wrap = this.messageContainer.createDiv({ cls: "pf-ai-confirmation" });
    const proceed = wrap.createEl("button", { text: "Proceed" });
    proceed.addClass("pf-ai-confirm");
    const reject = wrap.createEl("button", { text: "Reject" });
    reject.addClass("pf-ai-reject");
    proceed.onclick = () => this.controller?.handleFollowup("yes");
    reject.onclick = () => this.controller?.handleFollowup("no");
    this.messageContainer.scrollTo({ top: this.messageContainer.scrollHeight, behavior: "smooth" });
  }

  clearMessages(): void {
    this.messageContainer?.empty();
  }

  setBusy(busy: boolean): void {
    if (this.sendBtn) this.sendBtn.disabled = busy;
  }

  private async handleSend(): Promise<void> {
    const input = (this.inputEl?.value || "").trim();
    if (!input) return;
    if (this.inputEl) this.inputEl.value = "";
    await this.controller?.handleSend(input);
  }
}
