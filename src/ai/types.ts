import type { JSONSchema7 } from "./types-jsonschema";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: JSONSchema7;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentPlan {
  actions: ToolCall[];
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  arguments?: string;
}

export interface ProviderStreamEvent {
  type: "content" | "tool_call_delta" | "done";
  delta?: string;
  toolCalls?: ToolCallDelta[];
}
