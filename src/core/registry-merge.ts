import type { EntityTypesRegistry, ProjectTypesRegistry } from "../interfaces";
import { DEFAULT_ENTITY_TYPES, DEFAULT_PROJECT_TYPES } from "./registry-defaults";

export function mergeEntityTypes(
  userTypes?: Record<string, EntityTypesRegistry>,
  projectTypeId?: string,
): EntityTypesRegistry {
  const merged: EntityTypesRegistry = {};

  // Helper to merge a specific registry
  const mergeRegistry = (registry: EntityTypesRegistry) => {
    for (const [id, def] of Object.entries(registry)) {
      if (!def || typeof def !== "object") continue;
      merged[id] = { ...merged[id], ...def, id };
    }
  };

  // 1. Merge defaults
  if (projectTypeId && DEFAULT_ENTITY_TYPES[projectTypeId]) {
    mergeRegistry(DEFAULT_ENTITY_TYPES[projectTypeId]);
  } else {
    // Merge all defaults if no specific type requested
    for (const typeRegistry of Object.values(DEFAULT_ENTITY_TYPES)) {
      mergeRegistry(typeRegistry);
    }
  }

  // 2. Merge user overrides
  if (userTypes && typeof userTypes === "object") {
    if (projectTypeId && userTypes[projectTypeId]) {
      mergeRegistry(userTypes[projectTypeId]);
    } else if (!projectTypeId) {
      // Merge all user types if no specific type requested
      for (const typeRegistry of Object.values(userTypes)) {
        if (typeRegistry && typeof typeRegistry === "object") {
          mergeRegistry(typeRegistry);
        }
      }
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
