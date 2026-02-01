import type { ProjectFlowPlugin } from "../../plugin";
import type { ChatMessage, ToolCall } from "../types/core";
import type { ToolDefinition } from "../types/tools";
import type { ChatUi, MessageHandle } from "../types/ui";
import type { AiStateStore } from "../domain/conversation";
import { streamProvider } from "../providers/provider";
import { buildToolCallsFromDeltas, finalizeToolCalls } from "../domain/tool-calls";
import { extractMissingFields } from "../domain/safety";
import { executeToolCalls } from "./tool-executor";
import { formatResult } from "../utils/format";
import { delay } from "../utils/time";

export async function runAgentLoop(options: {
  plugin: ProjectFlowPlugin;
  ui: ChatUi;
  state: AiStateStore;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxSteps?: number;
}): Promise<void> {
  const maxSteps = options.maxSteps ?? 6;
  for (let step = 0; step < maxSteps; step += 1) {
    const assistantEl = options.ui.appendMessage("assistant", "");
    const toolUsageEls = new Map<string, MessageHandle>();
    const toolCallsAccumulator = new Map<number, ToolCall>();
    const strict = Boolean(options.plugin.settings.ai?.strictExecution);
    const maxRetries = 2;
    let attempt = 0;

    /* eslint-disable no-constant-condition */
    while (true) {
      try {
        for await (const evt of streamProvider(options.plugin.settings.ai!, options.messages, options.tools)) {
          if (evt.type === "content" && evt.delta) {
            const current = assistantEl?.textContent || "";
            options.ui.updateMessage(assistantEl, current + evt.delta);
          }
          if (evt.type === "tool_call_delta" && evt.toolCalls) {
            buildToolCallsFromDeltas(evt.toolCalls, toolCallsAccumulator);
            for (const delta of evt.toolCalls) {
              if (!delta.name) continue;
              if (!toolUsageEls.has(delta.name)) {
                const el = options.ui.appendMessage("tool", `Using tool: ${delta.name}`);
                if (el) toolUsageEls.set(delta.name, el);
              }
            }
          }
        }
        break;
      } catch (err: any) {
        attempt += 1;
        if (attempt > maxRetries) {
          throw err;
        }
        options.ui.appendMessage("tool", `Retrying LLM request (${attempt}/${maxRetries})...`);
        await delay(300 * attempt);
      }
    }

    const toolCalls = finalizeToolCalls(toolCallsAccumulator);
    const assistantContent = assistantEl?.textContent || "";
    options.messages.push({ role: "assistant", content: assistantContent, toolCalls });
    options.state.appendMessage({ role: "assistant", content: assistantContent });

    if (toolCalls.length === 0) {
      return;
    }

    for (const call of toolCalls) {
      options.ui.appendMessage("tool", `Tool call: ${call.name} ${formatResult(call.arguments)}`);
    }
    const results = await executeToolCalls(toolCalls, options.tools);
    const missingFields = extractMissingFields(results);
    for (let i = 0; i < results.length; i += 1) {
      const res = results[i];
      const payload = res.ok
        ? { ok: true, result: res.result }
        : { ok: false, error: res.error };
      const msg = res.ok
        ? `Tool result (${res.toolName}): ${formatResult(res.result)}`
        : `Tool error (${res.toolName}): ${res.error}`;
      options.ui.appendMessage("tool", msg);
      options.state.appendMessage({
        role: "tool",
        name: res.toolName,
        toolCallId: toolCalls[i]?.id,
        content: JSON.stringify(payload),
      });
      options.state.recordToolLog(res.toolName, res.ok, res.error);
      options.messages.push({
        role: "tool",
        name: res.toolName,
        toolCallId: toolCalls[i]?.id,
        content: JSON.stringify(payload),
      });
    }
    if (strict && results.some((r) => !r.ok)) {
      options.ui.appendMessage("assistant", "Strict mode: tool execution failed. Please adjust input and try again.");
      return;
    }
    if (missingFields.length > 0) {
      const unique = Array.from(new Set(missingFields));
      options.ui.appendMessage(
        "assistant",
        `Missing required fields: ${unique.join(", ")}. Please provide them and try again.`,
      );
      return;
    }
  }
  options.ui.appendMessage("assistant", "Stopped after reaching max tool steps.");
}
