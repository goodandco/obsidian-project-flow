import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyIntent } from "../src/ai/domain/intent";

const mocked = vi.hoisted(() => ({
  content: "",
}));

vi.mock("../src/ai/providers/provider", () => ({
  streamProvider: async function* () {
    if (mocked.content) {
      yield { type: "content", delta: mocked.content };
    }
    yield { type: "done" };
  },
}));

describe("classifyIntent", () => {
  beforeEach(() => {
    mocked.content = "";
  });

  it("parses valid intent JSON", async () => {
    mocked.content = "{\"intent\":\"chat\",\"reason\":\"q\",\"confidence\":0.9}";
    const res = await classifyIntent("What is GTD?", {
      enabled: true,
      provider: "openai",
      apiKey: "test",
    });
    expect(res.intent).toBe("chat");
    expect(res.reason).toBe("q");
    expect(res.confidence).toBeCloseTo(0.9);
  });

  it("defaults to chat on invalid JSON", async () => {
    mocked.content = "not-json";
    const res = await classifyIntent("hello", {
      enabled: true,
      provider: "openai",
      apiKey: "test",
    });
    expect(res.intent).toBe("chat");
    expect(res.confidence).toBe(0);
  });
});
