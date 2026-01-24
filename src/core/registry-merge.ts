import type { EntityTypesRegistry, ProjectTypesRegistry } from "../interfaces";
import { DEFAULT_ENTITY_TYPES, DEFAULT_PROJECT_TYPES } from "./registry-defaults";

export function mergeEntityTypes(
  userTypes?: EntityTypesRegistry,
): EntityTypesRegistry {
  const merged: EntityTypesRegistry = { ...DEFAULT_ENTITY_TYPES };
  if (userTypes && typeof userTypes === "object") {
    for (const [id, def] of Object.entries(userTypes)) {
      if (!def || typeof def !== "object") continue;
      merged[id] = { ...merged[id], ...def, id };
    }
  }
  return merged;
}

export function mergeProjectTypes(
  userTypes?: ProjectTypesRegistry,
): ProjectTypesRegistry {
  const merged: ProjectTypesRegistry = { ...DEFAULT_PROJECT_TYPES };
  if (userTypes && typeof userTypes === "object") {
    for (const [id, def] of Object.entries(userTypes)) {
      if (!def || typeof def !== "object") continue;
      merged[id] = { ...merged[id], ...def, id };
    }
  }
  return merged;
}
