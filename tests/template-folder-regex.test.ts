import { describe, it, expect } from "vitest";
import { templateToFolderRegex } from "../src/core/template-folder-regex";

describe("templateToFolderRegex", () => {
  it("matches a single-variable folder template (module)", () => {
    const re = templateToFolderRegex("Modules/${title}");
    expect(re.test("Modules/Module 1 - Intro")).toBe(true);
    expect(re.test("Modules/Another Module")).toBe(true);
    expect(re.test("Modules/")).toBe(false);
    expect(re.test("Modules/Module 1/Subdir")).toBe(false); // too deep
    expect(re.test("Other/Module 1")).toBe(false);
  });

  it("matches a dynamic-parent template (lesson)", () => {
    const re = templateToFolderRegex("${parentFolder}/Lessons/${title}");
    expect(re.test("Modules/Module 1 - Intro/Lessons/Lesson 1")).toBe(true);
    expect(re.test("Lessons/Lesson 1")).toBe(false); // parentFolder must be non-empty
    expect(re.test("Modules/Module 1/Lessons/")).toBe(false); // title missing
  });

  it("matches a static (no-variable) path", () => {
    const re = templateToFolderRegex("Work/Sprints");
    expect(re.test("Work/Sprints")).toBe(true);
    expect(re.test("Work/Sprints/Extra")).toBe(false);
    expect(re.test("Other/Sprints")).toBe(false);
  });

  it("escapes regex special chars in literal segments", () => {
    const re = templateToFolderRegex("Work.Archive/${title}");
    expect(re.test("Work.Archive/Item")).toBe(true);
    expect(re.test("WorkXArchive/Item")).toBe(false); // dot is literal, not wildcard
  });

  it("${parentFolder} matches multi-segment paths", () => {
    const re = templateToFolderRegex("${parentFolder}/Notes");
    expect(re.test("Modules/Mod1/Lessons/Lesson1/Notes")).toBe(true);
    expect(re.test("Modules/Mod1/Notes")).toBe(true);
    expect(re.test("Notes")).toBe(false); // needs at least one parent segment
  });
});
