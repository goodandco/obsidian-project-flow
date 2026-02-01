import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AiChatController } from "../src/ai/handlers/chat";

const mocked = vi.hoisted(() => ({
  classifyIntent: vi.fn(),
  chatContent: "",
  planningResult: null as any,
}));

vi.mock("../src/ai/domain/intent", () => ({
  classifyIntent: mocked.classifyIntent,
}));

vi.mock("../src/ai/providers/provider", () => ({
  streamProvider: async function* () {
    if (mocked.chatContent) {
      yield { type: "content", delta: mocked.chatContent };
    }
    yield { type: "done" };
  },
}));

vi.mock("../src/ai/domain/planner", () => ({
  runPlanningStage: vi.fn(async () => mocked.planningResult),
}));

vi.mock("../src/ai/domain/prompts", () => ({
  buildSystemPrompt: vi.fn(async () => "system"),
  buildUserMessage: vi.fn((input: string) => input),
}));

vi.mock("../src/ai/adapters/registry", () => ({
  createToolRegistry: vi.fn(() => []),
  loadMcpToolRegistry: vi.fn(async () => []),
}));

class FakeUi {
  messages: Array<{ role: string; content: string }> = [];
  appendMessage(role: any, content: string) {
    const handle = { textContent: content, index: this.messages.length };
    this.messages.push({ role, content });
    return handle as any;
  }
  updateMessage(handle: any, content: string) {
    handle.textContent = content;
    if (typeof handle.index === "number") {
      this.messages[handle.index].content = content;
    }
  }
  appendConfirmationActions() {
    this.messages.push({ role: "tool", content: "CONFIRM_ACTIONS" });
  }
  clearMessages() {
    this.messages = [];
  }
  setBusy() {}
}

class FakeState {
  private pending: any = null;
  private conversation: any[] = [];
  getConversationWindow() {
    return this.conversation;
  }
  appendMessage(message: any) {
    this.conversation.push(message);
  }
  getPendingPlan() {
    return this.pending;
  }
  setPendingPlan(pending: any) {
    this.pending = pending;
  }
  clearConversation() {}
  flushConversation() {}
  recordToolLog() {}
}

function makeController() {
  const plugin: any = {
    settings: {
      ai: {
        enabled: true,
        provider: "openai",
        apiKey: "test",
        mixedOfferText: "",
      },
    },
    saveSettings: async () => {},
  };
  return {
    controller: new AiChatController(plugin, new FakeUi() as any, new FakeState() as any),
  };
}

describe("golden conversation fixtures", () => {
  const fixturesPath = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/intent-conversations.json");
  const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"));

  beforeEach(() => {
    mocked.chatContent = "";
    mocked.planningResult = {
      needsFollowup: false,
      plan: "Do it",
      context: "ctx",
      fields: {},
    };
    mocked.classifyIntent.mockReset();
  });

  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const { controller } = makeController();
      for (const step of fixture.steps) {
        if (step.intent) {
          mocked.classifyIntent.mockResolvedValueOnce({ intent: step.intent, reason: "", confidence: 1 });
        }
        if (step.chatReply) {
          mocked.chatContent = step.chatReply;
        } else {
          mocked.chatContent = "";
        }
        if (step.planResult) {
          mocked.planningResult = step.planResult;
        }
        await controller.handleSend(step.user);
      }
      const ui = (controller as any).ui as FakeUi;
      const allText = ui.messages.map((m) => m.content).join("\n");
      const expected = fixture.steps.flatMap((s) => s.expectAssistantContains || []);
      for (const expectation of expected) {
        expect(allText).toContain(expectation);
      }
    });
  }
});
