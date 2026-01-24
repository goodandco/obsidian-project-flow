import { describe, it, expect } from "vitest";
import { buildProjectGraph, getChildren, getParents } from "../src/core/project-graph";
import type { ProjectRecord } from "../src/interfaces";

function makeRecord(fullName: string, parent?: string | null): ProjectRecord {
  return {
    info: {
      name: fullName.split(".").pop() || fullName,
      tag: `project/${fullName}`,
      id: fullName,
      dimension: "Business",
      category: "R&D",
      parent: parent ?? null,
      projectTypeId: "operational",
    },
    variables: {
      PROJECT_NAME: fullName,
      PROJECT_TAG: `project/${fullName}`,
      PROJECT_PARENT: parent ?? "",
      PARENT_TAG: "",
      YEAR: "2025",
      DATE: "2025-01-01",
      PROJECT_FULL_NAME: fullName,
      PROJECT_RELATIVE_PATH: `1. Projects/Business/R&D/${fullName}`,
      PROJECT_PATH: `1. Projects/Business/R&D/${fullName}`,
      DIMENSION: "Business",
      CATEGORY: "R&D",
      PROJECT_ID: fullName,
    },
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("projectGraph", () => {
  it("builds parent/child relationships for active records", () => {
    const parent = makeRecord("2025.Parent");
    const child = makeRecord("2025.Parent.Child", "2025.Parent");
    const graph = buildProjectGraph({
      Business: { "R&D": { P: parent, C: child } },
    });

    expect(getChildren(graph, "2025.Parent", false)).toEqual(["2025.Parent.Child"]);
    expect(getParents(graph, "2025.Parent.Child", false)).toEqual(["2025.Parent"]);
  });

  it("separates archived subtree", () => {
    const archived = makeRecord("2024.Archived", null);
    const graph = buildProjectGraph(undefined, {
      Business: { "R&D": { A: archived } },
    });

    expect(getChildren(graph, "2024.Archived", true)).toEqual([]);
    expect(getParents(graph, "2024.Archived", true)).toEqual([]);
    expect(getChildren(graph, "2024.Archived", false)).toEqual([]);
  });
});
