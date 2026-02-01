import type { IProjectFlowPlugin, EntityType, EntityTypesRegistry } from "../../interfaces";
import type { CreateEntityRequest, CreateEntityResult } from "../types";
import { mergeEntityTypes } from "../../core/registry-merge";
import { createEntity } from "../../services/entity-service";
import { validateCreateEntityRequest } from "../validators";

export function createEntityHandlers(plugin: IProjectFlowPlugin) {
  return {
    listEntityTypes: (): EntityTypesRegistry => {
      return mergeEntityTypes(plugin.settings.entityTypes);
    },
    describeEntityType: (id: string): EntityType | null => {
      const types = mergeEntityTypes(plugin.settings.entityTypes);
      return types[id] || null;
    },
    createEntity: async (req: CreateEntityRequest): Promise<CreateEntityResult> => {
      validateCreateEntityRequest(req);
      return createEntity(plugin, req);
    },
  };
}
