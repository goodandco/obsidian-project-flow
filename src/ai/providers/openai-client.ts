import type { ChatMessage, ProviderStreamEvent, ToolCallDelta } from "../types/core";
import type { ToolDefinition } from "../types/tools";

export interface OpenAIClientConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export async function* streamChatCompletion(
  config: OpenAIClientConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[],
): AsyncGenerator<ProviderStreamEvent> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const payload = {
    model: config.model,
    messages: messages.map((m) => {
      const msg: any = { role: m.role, content: m.content };
      if (m.role === "tool" && m.toolCallId) {
        msg.tool_call_id = m.toolCallId;
      }
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments ?? {}),
          },
        }));
      }
      return msg;
    }),
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema,
      },
    })),
    tool_choice: "auto",
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const text = await safeReadText(res);
    throw new Error(`OpenAI request failed: ${res.status} ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
      if (data === "[DONE]") {
        yield { type: "done" };
        return;
      }
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = json?.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        yield { type: "content", delta: delta.content };
      }
      if (delta.tool_calls) {
        const toolCalls: ToolCallDelta[] = delta.tool_calls.map((c: any) => ({
          index: c.index,
          id: c.id,
          name: c.function?.name,
          arguments: c.function?.arguments,
        }));
        yield { type: "tool_call_delta", toolCalls };
      }
    }
  }
  yield { type: "done" };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
