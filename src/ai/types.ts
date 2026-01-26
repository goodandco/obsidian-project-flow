import type { JSONSchema7 } from "./types-jsonschema";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
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
