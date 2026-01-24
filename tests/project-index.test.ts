import { describe, it, expect } from "vitest";
import { buildProjectIndex, ensureProjectIndex, PROJECT_INDEX_VERSION } from "../src/core/project-index";
import type { ProjectRecord } from "../src/interfaces";

function makeRecord(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    info: {
      name: "Alpha",
      tag: "project/alpha",
      id: "ALP",
      dimension: "Business",
      category: "R&D",
      parent: null,
      projectTypeId: "operational",
    },
    variables: {
      PROJECT_NAME: "Alpha",
      PROJECT_TAG: "project/alpha",
      PROJECT_PARENT: "",
      PARENT_TAG: "",
      YEAR: "2025",
      DATE: "2025-01-01",
      PROJECT_FULL_NAME: "2025.Alpha",
      PROJECT_RELATIVE_PATH: "1. Projects/Business/R&D/2025.Alpha",
      PROJECT_PATH: "1. Projects/Business/R&D/2025.Alpha",
      DIMENSION: "Business",
      CATEGORY: "R&D",
      PROJECT_ID: "ALP",
    },
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectIndex", () => {
  it("builds index from projectRecords", () => {
    const record = makeRecord();
    const index = buildProjectIndex({
      Business: { "R&D": { ALP: record } },
    });

    expect(index.version).toBe(PROJECT_INDEX_VERSION);
    expect(index.byFullName["2025.Alpha"]).toBeDefined();
    expect(index.byId["ALP"]).toBeDefined();
    expect(index.byTag["project/alpha"]).toBeDefined();
  });

  it("rebuilds when version mismatch", () => {
    const record = makeRecord();
    const { index, updated } = ensureProjectIndex(
      { version: 0, byFullName: {}, byId: {}, byTag: {} },
      { Business: { "R&D": { ALP: record } } },
    );

    expect(updated).toBe(true);
    expect(index.byId["ALP"]).toBeDefined();
  });
});
