import type { ToolDefinition, ToolExecutionResult } from "../types/tools";

export function filterSafeTools(tools: ToolDefinition[]): ToolDefinition[] {
  const safeNames = new Set([
    "resolveProject",
    "listProjects",
    "listEntityTypes",
    "describeEntityType",
    "listProjectTypes",
    "describeProjectType",
    "getChildren",
    "getParents",
  ]);
  return tools.filter((t) => safeNames.has(t.name) || t.name.includes(":"));
}

export function extractMissingFields(results: ToolExecutionResult[]): string[] {
  const missing: string[] = [];
  for (const res of results) {
    if (!res.ok && res.error?.startsWith("Missing required fields:")) {
      const parts = res.error.split(":").slice(1).join(":").split(",");
      parts.forEach((p) => {
        const val = p.trim();
        if (val) missing.push(val);
      });
    }
  }
  return missing;
}

export function isAffirmative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["yes", "y", "confirm", "ok", "okay", "proceed"].includes(normalized);
}

export function isNegative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["no", "n", "cancel", "stop"].includes(normalized);
}
