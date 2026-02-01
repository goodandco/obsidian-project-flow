export function formatResult(result: unknown): string {
  if (result == null) return "(no result)";
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}
