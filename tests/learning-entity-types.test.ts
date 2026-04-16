import { describe, it, expect } from "vitest";
import { DEFAULT_PROJECT_TYPES } from "../src/core/registry-defaults";
import { mergeEntityTypes } from "../src/core/registry-merge";

describe("learning entity types", () => {
  const learning = DEFAULT_PROJECT_TYPES.learning.projectEntities!;

  it("defines six entity types", () => {
    const keys = Object.keys(learning);
    expect(keys).toEqual(["module", "lesson", "note", "assignment", "review", "reference"]);
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
      expect(m.fields!.title.required).toBe(true);
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
      expect(l.fields!.title.required).toBe(true);
      expect(l.fields!.parentFolder.required).toBe(true);
    });

    it("parentFolder is a $dynamic reference with allowedParents", () => {
      const pf = l.fields!.parentFolder;
      expect(pf.type).toBe("reference");
      expect(pf.role).toBe("parentFolder");
      expect((pf as any).refersTo?.entityType).toBe("$dynamic");
      expect((pf as any).allowedParents).toContain("module");
      expect((pf as any).allowedParents).toContain("project");
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
      expect(n.fields!.title.required).toBe(true);
      expect(n.fields!.parentFolder.required).toBe(true);
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
      expect(a.fields!.title.required).toBe(true);
      expect(a.fields!.parentFolder.required).toBe(true);
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

  describe("reference", () => {
    const ref = learning.reference;

    it("targets References folder", () => {
      expect(ref.targetFolder).toBe("References");
    });

    it("requires title", () => {
      expect(ref.fields!.title.required).toBe(true);
    });
  });

  it("mergeEntityTypes returns learning types for learning projectTypeId", () => {
    const merged = mergeEntityTypes(DEFAULT_PROJECT_TYPES, "learning");
    expect(merged).toHaveProperty("module");
    expect(merged).toHaveProperty("lesson");
    expect(merged).toHaveProperty("note");
    expect(merged).toHaveProperty("assignment");
    expect(merged).toHaveProperty("review");
    expect(merged).toHaveProperty("reference");
    expect(merged).not.toHaveProperty("idea");
  });

  it("does not include idea in learning types", () => {
    expect(learning).not.toHaveProperty("idea");
  });
});
