import type { ChatRole, TokenUsage } from "./core";

export type MessageHandle = HTMLDivElement | null;

export interface ChatUi {
  appendMessage(role: ChatRole, content: string): MessageHandle;
  updateMessage(handle: MessageHandle, content: string): void;
  showUsage(handle: MessageHandle, usage: TokenUsage): void;
  appendConfirmationActions(): void;
  clearMessages(): void;
  setBusy(busy: boolean): void;
  openToolGroup(): void;
  closeToolGroup(label: string): void;
}
