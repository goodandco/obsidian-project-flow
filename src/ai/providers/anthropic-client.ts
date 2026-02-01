import type { ChatMessage, ProviderStreamEvent, ToolCallDelta } from "../types/core";
import type { ToolDefinition } from "../types/tools";

export interface AnthropicClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export async function* streamAnthropicMessages(
  config: AnthropicClientConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[],
): AsyncGenerator<ProviderStreamEvent> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const { system, anthropicMessages } = toAnthropicMessages(messages);

  const payload: any = {
    model: config.model,
    max_tokens: 1024,
    system,
    messages: anthropicMessages,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.schema,
    })),
    stream: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const text = await safeReadText(res);
    throw new Error(`Anthropic request failed: ${res.status} ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const suppressInputDelta = new Set<number>();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.replace(/^data:\s*/, "");
      if (!data || data === "[DONE]") {
        yield { type: "done" };
        return;
      }
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const type = json?.type;
      if (type === "content_block_delta") {
        const delta = json.delta;
        if (delta?.type === "text_delta") {
          yield { type: "content", delta: delta.text };
        }
        if (delta?.type === "input_json_delta") {
          if (suppressInputDelta.has(json.index)) continue;
          const toolCalls: ToolCallDelta[] = [{
            index: json.index,
            arguments: delta.partial_json,
          }];
          yield { type: "tool_call_delta", toolCalls };
        }
      }
      if (type === "content_block_start") {
        const block = json.content_block;
        if (block?.type === "tool_use") {
          const hasInput = block.input && Object.keys(block.input).length > 0;
          if (hasInput) {
            suppressInputDelta.add(json.index);
          }
          const toolCalls: ToolCallDelta[] = [{
            index: json.index,
            id: block.id,
            name: block.name,
            arguments: hasInput ? JSON.stringify(block.input) : "",
          }];
          yield { type: "tool_call_delta", toolCalls };
        }
      }
      if (type === "message_stop") {
        yield { type: "done" };
        return;
      }
    }
  }
  yield { type: "done" };
}

function toAnthropicMessages(messages: ChatMessage[]): { system: string; anthropicMessages: any[] } {
  let system = "";
  const out: any[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = [system, msg.content].filter(Boolean).join("\n");
      continue;
    }
    if (msg.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: msg.content }] });
      continue;
    }
    if (msg.role === "assistant") {
      const content: any[] = [];
      if (msg.content) content.push({ type: "text", text: msg.content });
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const call of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: call.id || `tool-${call.name}`,
            name: call.name,
            input: call.arguments || {},
          });
        }
      }
      if (content.length > 0) out.push({ role: "assistant", content });
      continue;
    }
    if (msg.role === "tool") {
      out.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: msg.toolCallId || msg.name || "tool",
          content: msg.content,
        }],
      });
    }
  }

  return { system, anthropicMessages: out };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
