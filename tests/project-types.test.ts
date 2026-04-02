import { describe, it, expect } from "vitest";
import { mergeProjectTypes } from "../src/core/registry-merge";
import { resolveProjectType } from "../src/core/project-types";
import type { ProjectFlowSettings } from "../src/interfaces";

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
    } as ProjectFlowSettings;

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
    } as ProjectFlowSettings;

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
    } as ProjectFlowSettings;

    const { projectTypeId, projectType } = resolveProjectType(settings, {
      name: "Machine Learning",
      tag: "ml",
      id: "ML",
      dimension: "Education",
      category: "AI",
      projectTypeId: "learning",
    });

    expect(projectTypeId).toBe("learning");
    expect(projectType.name).toBe("Course / Learning");
    expect(projectType.folderStructure).toContain("Modules");
    expect(projectType.folderStructure).toContain("Overview");
    expect(projectType.folderStructure).toContain("Notes");
    expect(projectType.folderStructure).toContain("Assignments");
    expect(projectType.folderStructure).toContain("Reviews");
    expect(projectType.folderStructure).toContain("Resources");
    expect(projectType.allowedEntityTypes).toContain("module");
    expect(projectType.allowedEntityTypes).toContain("lesson");
    expect(projectType.allowedEntityTypes).toContain("note");
    expect(projectType.allowedEntityTypes).toContain("assignment");
    expect(projectType.allowedEntityTypes).toContain("review");
    expect(projectType.allowedEntityTypes).not.toContain("idea");
  });
});
