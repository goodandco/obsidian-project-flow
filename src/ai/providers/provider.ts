import type { ChatMessage, ProviderStreamEvent } from "../types/core";
import type { ToolDefinition } from "../types/tools";
import type { AISettings } from "../../interfaces";
import { streamChatCompletion } from "./openai-client";
import { streamAnthropicMessages } from "./anthropic-client";

export async function* streamProvider(
  settings: AISettings,
  messages: ChatMessage[],
  tools: ToolDefinition[],
): AsyncGenerator<ProviderStreamEvent> {
  if (settings.provider === "anthropic") {
    if (!settings.apiKey) {
      throw new Error("Anthropic API key is missing");
    }
    yield* streamAnthropicMessages(
      {
        apiKey: settings.apiKey,
        model: settings.model || "claude-3-5-sonnet-latest",
        baseUrl: settings.baseUrl || "https://api.anthropic.com",
      },
      messages,
      tools,
    );
    return;
  }

  const baseUrl = settings.provider === "ollama"
    ? settings.baseUrl || "http://localhost:11434"
    : settings.baseUrl || "https://api.openai.com";

  if (!settings.apiKey && settings.provider !== "ollama") {
    throw new Error("OpenAI API key is missing");
  }

  yield* streamChatCompletion(
    {
      apiKey: settings.apiKey || "",
      model: settings.model || (settings.provider === "ollama" ? "llama3.1" : "gpt-4o-mini"),
      baseUrl,
    },
    messages,
    tools,
  );
}
