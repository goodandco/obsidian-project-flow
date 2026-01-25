import type { IProjectFlowPlugin } from "../interfaces";
import { mergeEntityTypes, mergeProjectTypes } from "../core/registry-merge";
import { createProject } from "./project-service";
import { createEntity } from "./entity-service";
import { patchMarkerInFile, patchSectionInFile } from "../core/markdown-patcher";
import { listProjects, resolveProject, resolveArchivedProject } from "./resolve-service";
import { cleanArchivedGraph, ensureProjectGraph, getChildren, getParents } from "../core/project-graph";
import { validateCreateEntityRequest, validateCreateProjectRequest, validatePatchMarkerRequest, validatePatchSectionRequest, validateProjectRef } from "../core/api-validators";
import { toApiError } from "../core/api-errors";
import { CURRENT_SETTINGS_SCHEMA_VERSION } from "../core/settings-schema";
import { PROJECT_INDEX_VERSION } from "../core/project-index";
import { PROJECT_GRAPH_VERSION } from "../core/project-graph";

export function createCoreApi(plugin: IProjectFlowPlugin) {
  const apiVersion = "1.0.0";
  return {
    version: apiVersion,
    capabilities: {
      resolveProject: true,
      listProjects: true,
      entityTypes: true,
      projectTypes: true,
      createProject: true,
      createEntity: true,
      patching: true,
      projectGraph: true,
      errorHandling: "throws",
    },
    compatibility: {
      settingsSchemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
      projectIndexVersion: PROJECT_INDEX_VERSION,
      projectGraphVersion: PROJECT_GRAPH_VERSION,
    },
    resolveProject: (ref: string | { fullName?: string; id?: string; tag?: string }) => {
      validateProjectRef(ref);
      return resolveProject(plugin, ref);
    },
    listProjects: () => {
      return listProjects(plugin);
    },
    listProjectTypes: () => {
      return mergeProjectTypes(plugin.settings.projectTypes);
    },
    describeProjectType: (id: string) => {
      const types = mergeProjectTypes(plugin.settings.projectTypes);
      return types[id] || null;
    },
    listEntityTypes: () => {
      return mergeEntityTypes(plugin.settings.entityTypes);
    },
    describeEntityType: (id: string) => {
      const types = mergeEntityTypes(plugin.settings.entityTypes);
      return types[id] || null;
    },
    createProject: async (req: any) => {
      validateCreateProjectRequest(req);
      return createProject(plugin, req);
    },
    createEntity: async (req: any) => {
      validateCreateEntityRequest(req);
      return createEntity(plugin, req);
    },
    patchMarker: async (req: any) => {
      validatePatchMarkerRequest(req);
      return patchMarkerInFile(plugin.app, req);
    },
    patchSection: async (req: any) => {
      validatePatchSectionRequest(req);
      return patchSectionInFile(plugin.app, req);
    },
    getChildren: (ref: string | { fullName?: string; id?: string; tag?: string }, archived?: boolean) => {
      validateProjectRef(ref);
      const resolved = archived ? resolveArchivedProject(plugin, ref) : resolveProject(plugin, ref);
      if (!resolved) return [];
      const { graph } = ensureProjectGraph(
        plugin.settings.projectGraph,
        plugin.settings.projectRecords,
        plugin.settings.archivedRecords,
      );
      return getChildren(graph, resolved.entry.fullName, Boolean(archived));
    },
    getParents: (ref: string | { fullName?: string; id?: string; tag?: string }, archived?: boolean) => {
      const resolved = archived ? resolveArchivedProject(plugin, ref) : resolveProject(plugin, ref);
      if (!resolved) return [];
      const { graph } = ensureProjectGraph(
        plugin.settings.projectGraph,
        plugin.settings.projectRecords,
        plugin.settings.archivedRecords,
      );
      return getParents(graph, resolved.entry.fullName, Boolean(archived));
    },
    clearArchivedProjectGraph: async () => {
      const { graph } = ensureProjectGraph(
        plugin.settings.projectGraph,
        plugin.settings.projectRecords,
        plugin.settings.archivedRecords,
      );
      plugin.settings.projectGraph = cleanArchivedGraph(
        graph,
        plugin.settings.archivedRecords,
      );
      await plugin.saveData(plugin.settings);
      return { ok: true };
    },
    wrapError: (err: unknown) => {
      const apiErr = toApiError(err);
      return { ok: false, error: { code: apiErr.code, message: apiErr.message, details: apiErr.details } };
    },
  };
}
