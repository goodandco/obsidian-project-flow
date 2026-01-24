import type { IProjectFlowPlugin, ProjectIndexEntry, ProjectRecord } from "../interfaces";
import { getProjectIndexCache, ensureProjectIndex } from "../core/project-index";

export type ProjectRef = string | { fullName?: string; id?: string; tag?: string };

export interface ResolvedProject {
  entry: ProjectIndexEntry;
  record: ProjectRecord;
}

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
