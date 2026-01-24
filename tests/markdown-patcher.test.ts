import { describe, it, expect } from "vitest";
import { patchTextByMarker, patchTextByHeading } from "../src/core/markdown-patcher";

describe("markdown-patcher", () => {
  it("replaces content after marker", () => {
    const input = "<!-- AI:CONTENT -->\nOld content\n<!-- AI:ACTIONS -->\n";
    const res = patchTextByMarker(input, "AI:CONTENT", "New content", "lenient");
    expect(res.updated).toBe(true);
    expect(res.text).toContain("<!-- AI:CONTENT -->\nNew content\n<!-- AI:ACTIONS -->");
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
