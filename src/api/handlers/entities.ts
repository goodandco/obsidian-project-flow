import type { IProjectFlowPlugin, EntityType, EntityTypesRegistry } from "../../interfaces";
import type { CreateEntityRequest, CreateEntityResult } from "../types";
import { mergeEntityTypes } from "../../core/registry-merge";
import { createEntity } from "../../services/entity-service";
import { validateCreateEntityRequest } from "../validators";

export function createEntityHandlers(plugin: IProjectFlowPlugin) {
  return {
    listEntityTypes: (): EntityTypesRegistry => {
      // Returns flat list of all available entity types across all project types
      return mergeEntityTypes(plugin.settings.entityTypes);
    },
    describeEntityType: (id: string): EntityType | null => {
      // Checks across all project types
      const types = mergeEntityTypes(plugin.settings.entityTypes);
      return types[id] || null;
    },
    createEntity: async (req: CreateEntityRequest): Promise<CreateEntityResult> => {
      validateCreateEntityRequest(req);
      return createEntity(plugin, req);
    },
  };
}
