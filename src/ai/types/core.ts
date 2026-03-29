export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderStreamEvent {
  type: "content" | "tool_call_delta" | "usage" | "done";
  delta?: string;
  toolCalls?: ToolCallDelta[];
  usage?: TokenUsage;
}
