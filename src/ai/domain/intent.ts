import type { AISettings } from "../../interfaces";
import type { ChatMessage } from "../types/core";
import { streamProvider } from "../providers/provider";

export type Intent = "chat" | "action" | "mixed" | "unclear";

export interface IntentResult {
  intent: Intent;
  reason: string;
  confidence: number;
}

const INTENT_PROMPT = [
  "You are an intent classifier for an Obsidian productivity assistant.",
  "Classify the user input into exactly one of: chat, action, mixed, unclear.",
  "Definitions:",
  "chat: user is asking a question or discussing concepts. No execution requested.",
  "action: user explicitly requests operations such as creating, updating, deleting projects, tasks, notes, or structures.",
  "mixed: user asks a question AND requests an action in the same message.",
  "unclear: not enough information to decide.",
  "Respond ONLY with valid JSON:",
  "{\"intent\":\"...\",\"reason\":\"...\",\"confidence\":0.0}",
  "Do not include markdown.",
].join("\n");

const DEFAULT_INTENT: IntentResult = {
  intent: "chat",
  reason: "Invalid classifier output.",
  confidence: 0,
};

export async function classifyIntent(input: string, settings: AISettings): Promise<IntentResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: INTENT_PROMPT },
    { role: "user", content: input },
  ];
  let content = "";
  try {
    for await (const evt of streamProvider(settings, messages, [])) {
      if (evt.type === "content" && evt.delta) {
        content += evt.delta;
      }
    }
    const parsed = parseIntentJson(content);
    return parsed ?? DEFAULT_INTENT;
  } catch {
    return DEFAULT_INTENT;
  }
}

function parseIntentJson(raw: string): IntentResult | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = raw.slice(start, end + 1);
  try {
    const obj = JSON.parse(slice);
    const intent = normalizeIntent(obj.intent);
    if (!intent) return null;
    const confidence = typeof obj.confidence === "number" && obj.confidence >= 0 && obj.confidence <= 1
      ? obj.confidence
      : 0;
    return {
      intent,
      reason: typeof obj.reason === "string" ? obj.reason : "",
      confidence,
    };
  } catch {
    return null;
  }
}

function normalizeIntent(value: unknown): Intent | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "chat" || normalized === "action" || normalized === "mixed" || normalized === "unclear") {
    return normalized;
  }
  return null;
}
