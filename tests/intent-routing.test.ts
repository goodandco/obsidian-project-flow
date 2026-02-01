import { describe, it, expect, vi, beforeEach } from "vitest";
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
    plugin,
  };
}

describe("intent routing", () => {
  beforeEach(() => {
    mocked.chatContent = "";
    mocked.planningResult = {
      needsFollowup: false,
      plan: "Do it",
      context: "",
      fields: {},
    };
    mocked.classifyIntent.mockReset();
  });

  it("routes chat intent to chat-only response", async () => {
    const { controller } = makeController();
    mocked.chatContent = "Hello there.";
    mocked.classifyIntent.mockResolvedValue({ intent: "chat", reason: "", confidence: 1 });
    await controller.handleSend("Hi");
    const ui = (controller as any).ui as FakeUi;
    expect(ui.messages.some((m) => m.role === "assistant" && m.content.includes("Hello there."))).toBe(true);
  });

  it("routes action intent to planner flow", async () => {
    const { controller } = makeController();
    mocked.classifyIntent.mockResolvedValue({ intent: "action", reason: "", confidence: 1 });
    await controller.handleSend("Create project");
    const ui = (controller as any).ui as FakeUi;
    expect(ui.messages.some((m) => m.content.includes("Planned steps:"))).toBe(true);
    expect(ui.messages.some((m) => m.content.includes("Please confirm to proceed"))).toBe(true);
  });

  it("routes unclear intent to clarification prompt", async () => {
    const { controller } = makeController();
    mocked.classifyIntent.mockResolvedValue({ intent: "unclear", reason: "", confidence: 0.4 });
    await controller.handleSend("Maybe");
    const ui = (controller as any).ui as FakeUi;
    expect(ui.messages.some((m) => m.content.includes("Could you clarify what you'd like me to do?"))).toBe(true);
  });
});
