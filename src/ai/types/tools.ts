import type { JSONSchema7 } from "../schemas/jsonschema";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: JSONSchema7;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}
