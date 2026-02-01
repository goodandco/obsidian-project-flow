import type { IProjectFlowPlugin, ProjectIndexEntry, ProjectRecord } from "../interfaces";
import type { ProjectRef, ResolvedProject } from "../api/types";
import { getProjectIndexCache, ensureProjectIndex } from "../core/project-index";

export type { ProjectRef, ResolvedProject } from "../api/types";

export function resolveProject(
  plugin: IProjectFlowPlugin,
  ref: ProjectRef,
): ResolvedProject | null {
  const index =
    getProjectIndexCache() ||
    ensureProjectIndex(plugin.settings.projectIndex, plugin.settings.projectRecords).index;

  const lookup = normalizeProjectRef(ref);
  const entry =
    (lookup.fullName && index.byFullName[lookup.fullName]) ||
    (lookup.id && index.byId[lookup.id]) ||
    (lookup.tag && index.byTag[lookup.tag]);
  if (!entry) return null;

  const record = plugin.settings.projectRecords?.[entry.dimension]?.[entry.category]?.[entry.projectId];
  if (!record) return null;
  return { entry, record };
}

export function resolveArchivedProject(
  plugin: IProjectFlowPlugin,
  ref: ProjectRef,
): ResolvedProject | null {
  const lookup = normalizeProjectRef(ref);
  const record = findRecordByRef(plugin.settings.archivedRecords, lookup);
  if (!record) return null;
  return {
    entry: {
      fullName: record.variables.PROJECT_FULL_NAME,
      projectId: record.info.id,
      projectTag: record.variables.PROJECT_TAG,
      path: record.variables.PROJECT_PATH,
      dimension: record.info.dimension,
      category: record.info.category,
      projectName: record.info.name,
      parent: record.info.parent ?? null,
    },
    record,
  };
}

export function listProjects(
  plugin: IProjectFlowPlugin,
): ProjectIndexEntry[] {
  const index =
    getProjectIndexCache() ||
    ensureProjectIndex(plugin.settings.projectIndex, plugin.settings.projectRecords).index;
  return Object.values(index.byFullName);
}

function normalizeProjectRef(ref: ProjectRef): { fullName?: string; id?: string; tag?: string } {
  if (typeof ref === "string") {
    const trimmed = ref.trim();
    if (trimmed.startsWith("project/")) return { tag: trimmed };
    if (trimmed.includes(".")) return { fullName: trimmed };
    return { id: trimmed };
  }
  return {
    fullName: ref.fullName?.trim(),
    id: ref.id?.trim(),
    tag: ref.tag?.trim(),
  };
}

function findRecordByRef(
  records: Record<string, Record<string, Record<string, ProjectRecord>>> | undefined,
  lookup: { fullName?: string; id?: string; tag?: string },
): ProjectRecord | null {
  if (!records) return null;
  for (const categories of Object.values(records)) {
    for (const projects of Object.values(categories)) {
      for (const record of Object.values(projects)) {
        if (!record) continue;
        if (lookup.fullName && record.variables.PROJECT_FULL_NAME === lookup.fullName) {
          return record;
        }
        if (lookup.id && record.info.id === lookup.id) {
          return record;
        }
        if (lookup.tag && record.variables.PROJECT_TAG === lookup.tag) {
          return record;
        }
      }
    }
  }
  return null;
}
