import type { ToolCall, ToolCallDelta } from "../types/core";

export function buildToolCallsFromDeltas(
  deltas: ToolCallDelta[],
  accumulator: Map<number, ToolCall>,
): void {
  for (const delta of deltas) {
    const current = accumulator.get(delta.index) || { name: "", arguments: {} } as ToolCall;
    if (delta.id) current.id = delta.id;
    if (delta.name) current.name = delta.name;
    if (typeof delta.arguments === "string") {
      const prev = (current as any)._rawArgs || "";
      (current as any)._rawArgs = prev + delta.arguments;
    }
    accumulator.set(delta.index, current);
  }
}

export function finalizeToolCalls(accumulator: Map<number, ToolCall>): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const [, call] of accumulator) {
    const raw = (call as any)._rawArgs as string | undefined;
    if (raw) {
      try {
        call.arguments = JSON.parse(raw);
      } catch {
        call.arguments = {};
      }
    }
    delete (call as any)._rawArgs;
    calls.push(call);
  }
  return calls;
}
