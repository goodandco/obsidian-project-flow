import type { IProjectFlowPlugin } from "../interfaces";
import { mergeEntityTypes, mergeProjectTypes } from "../core/registry-merge";
import { createProject } from "./project-service";
import { createEntity } from "./entity-service";
import { patchMarkerInFile, patchSectionInFile } from "../core/markdown-patcher";
import { listProjects, resolveProject } from "./resolve-service";

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
    },
    resolveProject: (ref: string | { fullName?: string; id?: string; tag?: string }) => {
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
      return createProject(plugin, req);
    },
    createEntity: async (req: any) => {
      return createEntity(plugin, req);
    },
    patchMarker: async (req: any) => {
      return patchMarkerInFile(plugin.app, req);
    },
    patchSection: async (req: any) => {
      return patchSectionInFile(plugin.app, req);
    },
  };
}
