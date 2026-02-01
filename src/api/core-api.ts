import type { IProjectFlowPlugin } from "../interfaces";
import type { ProjectFlowApi } from "./types";
import { createEntityHandlers } from "./handlers/entities";
import { createPatchingHandlers } from "./handlers/patching";
import { createProjectHandlers } from "./handlers/projects";
import { toApiError } from "./errors";
import { CURRENT_SETTINGS_SCHEMA_VERSION } from "../core/settings-schema";
import { PROJECT_INDEX_VERSION } from "../core/project-index";
import { PROJECT_GRAPH_VERSION } from "../core/project-graph";

export function createCoreApi(plugin: IProjectFlowPlugin): ProjectFlowApi {
  const apiVersion = "1.0.0";
  const projectHandlers = createProjectHandlers(plugin);
  const entityHandlers = createEntityHandlers(plugin);
  const patchingHandlers = createPatchingHandlers(plugin);
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
    ...projectHandlers,
    ...entityHandlers,
    ...patchingHandlers,
    wrapError: (err: unknown) => {
      const apiErr = toApiError(err);
      return { ok: false, error: { code: apiErr.code, message: apiErr.message, details: apiErr.details } };
    },
  };
}
