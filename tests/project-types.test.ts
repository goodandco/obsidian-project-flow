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
});
