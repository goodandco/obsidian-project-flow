export * from "./types/index";

import type { ToolCall } from "./types/core";

export interface AgentPlan {
  actions: ToolCall[];
}
