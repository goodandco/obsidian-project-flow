import type { ProjectIndex, ProjectIndexEntry, ProjectRecord } from "../interfaces";

export const PROJECT_INDEX_VERSION = 1;

let cachedIndex: ProjectIndex | null = null;

export function getProjectIndexCache(): ProjectIndex | null {
  return cachedIndex;
}

export function setProjectIndexCache(index: ProjectIndex): void {
  cachedIndex = index;
}

export function buildProjectIndex(
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
): ProjectIndex {
  const byFullName: Record<string, ProjectIndexEntry> = {};
  const byId: Record<string, ProjectIndexEntry> = {};
  const byTag: Record<string, ProjectIndexEntry> = {};

  if (projectRecords && typeof projectRecords === "object") {
    for (const [dimension, categories] of Object.entries(projectRecords)) {
      if (!categories || typeof categories !== "object") continue;
      for (const [category, projects] of Object.entries(categories)) {
        if (!projects || typeof projects !== "object") continue;
        for (const [projectId, record] of Object.entries(projects)) {
          if (!record || !record.variables || !record.info) continue;
          const entry = toIndexEntry(record, projectId, dimension, category);
          byFullName[entry.fullName] = entry;
          byId[entry.projectId] = entry;
          byTag[entry.projectTag] = entry;
        }
      }
    }
  }

  return {
    version: PROJECT_INDEX_VERSION,
    byFullName,
    byId,
    byTag,
  };
}

export function toIndexEntry(
  record: ProjectRecord,
  projectId: string,
  dimension: string,
  category: string,
): ProjectIndexEntry {
  return {
    fullName: record.variables.PROJECT_FULL_NAME,
    projectId,
    projectTag: record.variables.PROJECT_TAG,
    path: record.variables.PROJECT_PATH,
    dimension,
    category,
    projectName: record.info.name,
    parent: record.info.parent ?? null,
  };
}

export function ensureProjectIndex(
  current: ProjectIndex | undefined,
  projectRecords?: Record<string, Record<string, Record<string, ProjectRecord>>>,
): { index: ProjectIndex; updated: boolean } {
  if (!current || current.version !== PROJECT_INDEX_VERSION) {
    const rebuilt = buildProjectIndex(projectRecords);
    cachedIndex = rebuilt;
    return { index: rebuilt, updated: true };
  }
  cachedIndex = current;
  return { index: current, updated: false };
}

export function addToProjectIndex(
  index: ProjectIndex,
  record: ProjectRecord,
  projectId: string,
  dimension: string,
  category: string,
): ProjectIndex {
  const entry = toIndexEntry(record, projectId, dimension, category);
  index.byFullName[entry.fullName] = entry;
  index.byId[entry.projectId] = entry;
  index.byTag[entry.projectTag] = entry;
  return index;
}

export function removeFromProjectIndex(
  index: ProjectIndex,
  entry: ProjectIndexEntry,
): ProjectIndex {
  delete index.byFullName[entry.fullName];
  delete index.byId[entry.projectId];
  delete index.byTag[entry.projectTag];
  return index;
}
