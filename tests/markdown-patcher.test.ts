import { describe, it, expect } from "vitest";
import { patchTextByMarker, patchTextByHeading } from "../src/core/markdown-patcher";

describe("markdown-patcher", () => {
  it("replaces content between matching start and end markers", () => {
    const input = [
      "### Summary",
      "<!-- ai:summary> <!-- /ai:summary -->",
      "",
      "### Notes",
      "<!-- ai:notes> <!-- /ai:notes -->",
      "",
    ].join("\n");
    const res = patchTextByMarker(input, "ai:summary", "New content", "lenient");
    expect(res.updated).toBe(true);
    expect(res.text).toContain("<!-- ai:summary>\nNew content\n<!-- /ai:summary -->");
    expect(res.text).toContain("### Notes\n<!-- ai:notes> <!-- /ai:notes -->");
  });

  it("falls back to heading in lenient mode", () => {
    const input = "## Notes\nOld\n";
    const res = patchTextByMarker(input, "AI:CONTENT", "New", "lenient", "Notes");
    expect(res.updated).toBe(true);
    expect(res.text).toContain("## Notes\nNew\n");
  });

  it("returns unchanged in strict mode when missing heading", () => {
    const input = "# Title\nBody\n";
    const res = patchTextByHeading(input, "Missing", "New", "strict");
    expect(res.updated).toBe(false);
    expect(res.text).toBe(input);
  });
});
