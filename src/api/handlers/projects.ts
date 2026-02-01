import type { IProjectFlowPlugin, ProjectIndexEntry, ProjectType, ProjectTypesRegistry } from "../../interfaces";
import type { CreateProjectRequest, CreateProjectResult, ProjectRef } from "../types";
import { mergeProjectTypes } from "../../core/registry-merge";
import { createProject } from "../../services/project-service";
import { listProjects, resolveArchivedProject, resolveProject } from "../../services/resolve-service";
import { cleanArchivedGraph, ensureProjectGraph, getChildren, getParents } from "../../core/project-graph";
import { validateCreateProjectRequest, validateProjectRef } from "../validators";

export function createProjectHandlers(plugin: IProjectFlowPlugin) {
  return {
    resolveProject: (ref: ProjectRef) => {
      validateProjectRef(ref);
      return resolveProject(plugin, ref);
    },
    listProjects: (): ProjectIndexEntry[] => {
      return listProjects(plugin);
    },
    listProjectTypes: (): ProjectTypesRegistry => {
      return mergeProjectTypes(plugin.settings.projectTypes);
    },
    describeProjectType: (id: string): ProjectType | null => {
      const types = mergeProjectTypes(plugin.settings.projectTypes);
      return types[id] || null;
    },
    createProject: async (req: CreateProjectRequest): Promise<CreateProjectResult> => {
      validateCreateProjectRequest(req);
      return createProject(plugin, req);
    },
    getChildren: (ref: ProjectRef, archived?: boolean): string[] => {
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
    getParents: (ref: ProjectRef, archived?: boolean): string[] => {
      const resolved = archived ? resolveArchivedProject(plugin, ref) : resolveProject(plugin, ref);
      if (!resolved) return [];
      const { graph } = ensureProjectGraph(
        plugin.settings.projectGraph,
        plugin.settings.projectRecords,
        plugin.settings.archivedRecords,
      );
      return getParents(graph, resolved.entry.fullName, Boolean(archived));
    },
    clearArchivedProjectGraph: async (): Promise<{ ok: true }> => {
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
  };
}
