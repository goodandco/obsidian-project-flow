import { describe, it, expect } from "vitest";
import { mergeProjectTypes } from "../src/core/registry-merge";
import { resolveProjectType } from "../src/core/project-types";

describe("projectTypes", () => {
  it("merges user overrides by id", () => {
    const merged = mergeProjectTypes({
      operational: { id: "operational", name: "Custom Operational" },
      custom: { id: "custom", name: "Custom Type" },
    });

    expect(merged.operational.name).toBe("Custom Operational");
    expect(merged.custom.name).toBe("Custom Type");
  });

  it("resolves requested projectTypeId when present", () => {
    const settings = {
      projectTypes: {
        operational: { id: "operational", name: "Operational" },
        portfolio: { id: "portfolio", name: "Portfolio" },
      },
    } as unknown as Parameters<typeof resolveProjectType>[0];

    const { projectTypeId } = resolveProjectType(settings, {
      name: "Alpha",
      tag: "project/alpha",
      id: "ALP",
      dimension: "Business",
      category: "R&D",
      projectTypeId: "portfolio",
    });

    expect(projectTypeId).toBe("portfolio");
  });

  it("falls back to operational when id missing", () => {
    const settings = {
      projectTypes: {
        operational: { id: "operational", name: "Operational" },
      },
    } as unknown as Parameters<typeof resolveProjectType>[0];

    const { projectTypeId } = resolveProjectType(settings, {
      name: "Alpha",
      tag: "project/alpha",
      id: "ALP",
      dimension: "Business",
      category: "R&D",
    });

    expect(projectTypeId).toBe("operational");
  });

  it("resolves the learning project type from defaults", async () => {
    const { DEFAULT_PROJECT_TYPES } = await import("../src/core/registry-defaults");
    const settings = {
      projectTypes: DEFAULT_PROJECT_TYPES,
    } as unknown as Parameters<typeof resolveProjectType>[0];

    const { projectTypeId, projectType } = resolveProjectType(settings, {
      name: "Machine Learning",
      tag: "ml",
      id: "ML",
      dimension: "Education",
      category: "AI",
      projectTypeId: "learning",
    });

    const entityKeys = Object.keys(projectType.projectEntities ?? {});

    expect(projectTypeId).toBe("learning");
    expect(projectType.name).toBe("Course / Learning");
    expect(projectType.folderStructure).toContain("Modules");
    expect(projectType.folderStructure).toContain("Overview");
    expect(projectType.folderStructure).toContain("References");
    expect(entityKeys).toContain("module");
    expect(entityKeys).toContain("lesson");
    expect(entityKeys).toContain("note");
    expect(entityKeys).toContain("assignment");
    expect(entityKeys).toContain("review");
    expect(entityKeys).not.toContain("idea");
  });
});
