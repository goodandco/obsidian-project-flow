import { describe, it, expect } from "vitest";
import { DEFAULT_ENTITY_TYPES } from "../src/core/registry-defaults";
import { mergeEntityTypes } from "../src/core/registry-merge";

describe("learning entity types", () => {
  const learning = DEFAULT_ENTITY_TYPES.learning;

  it("defines five entity types", () => {
    const keys = Object.keys(learning);
    expect(keys).toEqual(["module", "lesson", "note", "assignment", "review"]);
  });

  describe("module", () => {
    const m = learning.module;

    it("creates a self-named folder under Modules/", () => {
      expect(m.targetFolder).toBe("Modules/${title}");
    });

    it("has childFolders for sub-entities", () => {
      expect(m.childFolders).toEqual(["Lessons", "Notes", "Assignments", "Reviews"]);
    });

    it("requires only title", () => {
      expect(m.requiredFields).toEqual(["title"]);
    });

    it("has AI markers", () => {
      expect(m.patchMarkers).toContain("AI:CONTENT");
      expect(m.patchMarkers).toContain("AI:OBJECTIVES");
      expect(m.patchMarkers).toContain("AI:SUMMARY");
    });
  });

  describe("lesson", () => {
    const l = learning.lesson;

    it("uses parentFolder for nesting inside modules", () => {
      expect(l.targetFolder).toBe("${parentFolder}/Lessons/${title}");
    });

    it("requires title and parentFolder", () => {
      expect(l.requiredFields).toContain("title");
      expect(l.requiredFields).toContain("parentFolder");
    });

    it("has childFolders for notes/assignments/reviews", () => {
      expect(l.childFolders).toEqual(["Notes", "Assignments", "Reviews"]);
    });
  });

  describe("note", () => {
    const n = learning.note;

    it("targets parentFolder/Notes", () => {
      expect(n.targetFolder).toBe("${parentFolder}/Notes");
    });

    it("requires title and parentFolder", () => {
      expect(n.requiredFields).toContain("title");
      expect(n.requiredFields).toContain("parentFolder");
    });

    it("has no childFolders", () => {
      expect(n.childFolders).toBeUndefined();
    });
  });

  describe("assignment", () => {
    const a = learning.assignment;

    it("targets parentFolder/Assignments", () => {
      expect(a.targetFolder).toBe("${parentFolder}/Assignments");
    });

    it("requires title and parentFolder", () => {
      expect(a.requiredFields).toContain("title");
      expect(a.requiredFields).toContain("parentFolder");
    });

    it("has submission-related markers", () => {
      expect(a.patchMarkers).toContain("AI:REQUIREMENTS");
      expect(a.patchMarkers).toContain("AI:SUBMISSION");
    });
  });

  describe("review", () => {
    const r = learning.review;

    it("targets parentFolder/Reviews", () => {
      expect(r.targetFolder).toBe("${parentFolder}/Reviews");
    });

    it("has reflection-related markers", () => {
      expect(r.patchMarkers).toContain("AI:REFLECTION");
      expect(r.patchMarkers).toContain("AI:ACTIONS");
    });
  });

  it("mergeEntityTypes returns learning types for learning projectTypeId", () => {
    const merged = mergeEntityTypes({}, "learning");
    expect(merged).toHaveProperty("module");
    expect(merged).toHaveProperty("lesson");
    expect(merged).toHaveProperty("note");
    expect(merged).toHaveProperty("assignment");
    expect(merged).toHaveProperty("review");
    expect(merged).not.toHaveProperty("idea");
  });

  it("does not include idea in learning types", () => {
    expect(learning).not.toHaveProperty("idea");
  });
});
