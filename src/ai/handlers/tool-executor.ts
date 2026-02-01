import type { ToolCall } from "../types/core";
import type { ToolDefinition, ToolExecutionResult } from "../types/tools";
import { validateSchema } from "../schemas/validator";

export async function executeToolCalls(
  toolCalls: ToolCall[],
  tools: ToolDefinition[],
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  for (const call of toolCalls) {
    const tool = toolMap.get(call.name);
    if (!tool) {
      results.push({ toolName: call.name, ok: false, error: "Tool not found" });
      continue;
    }
    const errors = validateSchema(tool.schema, call.arguments);
    if (errors.length > 0) {
      results.push({
        toolName: call.name,
        ok: false,
        error: `Schema validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`,
      });
      continue;
    }
    try {
      const result = await tool.handler(call.arguments);
      results.push({ toolName: call.name, ok: true, result });
    } catch (err: any) {
      results.push({ toolName: call.name, ok: false, error: err?.message || "Tool execution failed" });
    }
  }

  return results;
}
