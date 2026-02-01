import type { ChatRole } from "./core";

export type MessageHandle = HTMLDivElement | null;

export interface ChatUi {
  appendMessage(role: ChatRole, content: string): MessageHandle;
  updateMessage(handle: MessageHandle, content: string): void;
  appendConfirmationActions(): void;
  clearMessages(): void;
  setBusy(busy: boolean): void;
}
