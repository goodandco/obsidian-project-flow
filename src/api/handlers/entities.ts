import type { IProjectFlowPlugin, EntityType, EntityTypesRegistry } from "../../interfaces";
import type { CreateEntityRequest, CreateEntityResult } from "../types";
import { mergeEntityTypes, mergeProjectTypes } from "../../core/registry-merge";
import { createEntity } from "../../services/entity-service";
import { validateCreateEntityRequest } from "../validators";

export function createEntityHandlers(plugin: IProjectFlowPlugin) {
  return {
    listEntityTypes: (): EntityTypesRegistry => {
      return mergeEntityTypes(mergeProjectTypes(plugin.settings.projectTypes));
    },
    describeEntityType: (id: string): EntityType | null => {
      const types = mergeEntityTypes(mergeProjectTypes(plugin.settings.projectTypes));
      return types[id] || null;
    },
    createEntity: async (req: CreateEntityRequest): Promise<CreateEntityResult> => {
      validateCreateEntityRequest(req);
      return createEntity(plugin, req);
    },
  };
}
