import type { EntityTypesRegistry, ProjectTypesRegistry } from "../interfaces";
import { DEFAULT_PROJECT_TYPES } from "./registry-defaults";

export function mergeEntityTypes(
  projectTypes: ProjectTypesRegistry,
  projectTypeId?: string,
): EntityTypesRegistry {
  const merged: EntityTypesRegistry = {};

  const mergeRegistry = (registry: EntityTypesRegistry) => {
    for (const [id, def] of Object.entries(registry)) {
      if (!def || typeof def !== "object") continue;
      merged[id] = { ...merged[id], ...def, id };
    }
  };

  if (projectTypeId) {
    const pt = projectTypes[projectTypeId];
    if (pt?.projectEntities) mergeRegistry(pt.projectEntities);
  } else {
    for (const pt of Object.values(projectTypes)) {
      if (pt?.projectEntities) mergeRegistry(pt.projectEntities);
    }
  }

  return merged;
}

export function mergeProjectTypes(
  userTypes?: ProjectTypesRegistry,
): ProjectTypesRegistry {
  const merged: ProjectTypesRegistry = {};

  // Start with defaults
  for (const [id, def] of Object.entries(DEFAULT_PROJECT_TYPES)) {
    merged[id] = { ...def };
  }

  // Deep-merge user overrides
  if (userTypes && typeof userTypes === "object") {
    for (const [id, def] of Object.entries(userTypes)) {
      if (!def || typeof def !== "object") continue;
      merged[id] = {
        ...merged[id],
        ...def,
        id,
        projectEntities: {
          ...(merged[id]?.projectEntities ?? {}),
          ...(def.projectEntities ?? {}),
        },
      };
    }
  }

  return merged;
}
