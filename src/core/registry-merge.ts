import type { EntityType, EntityTypesRegistry, ProjectTypesRegistry } from "../interfaces";
import { DEFAULT_PROJECT_TYPES } from "./registry-defaults";

function normalizeEntityType(et: EntityType): EntityType {
  const out = { ...et };

  if (out.fields) {
    // Backward: derive legacy properties from fields so existing consumers work unchanged
    const requiredFields: string[] = [];
    const fieldDescriptions: Record<string, string> = {};
    const fieldDefaults: Record<string, string> = {};
    let indexField: string | undefined;

    for (const [key, schema] of Object.entries(out.fields)) {
      if (schema.role === "index") { indexField = key; continue; }
      // parentFolder (role: "parentFolder") IS included in requiredFields —
      // the agent must supply it; the planner filters it via AGENT_RESOLVED_FIELDS
      if (schema.required) requiredFields.push(key);
      if (schema.description) fieldDescriptions[key] = schema.description;
      if (schema.default != null) fieldDefaults[key] = String(schema.default);
    }

    if (!out.requiredFields) out.requiredFields = requiredFields;
    if (!out.indexField && indexField) out.indexField = indexField;
    if (!out.fieldDescriptions && Object.keys(fieldDescriptions).length > 0) out.fieldDescriptions = fieldDescriptions;
    if (!out.fieldDefaults && Object.keys(fieldDefaults).length > 0) out.fieldDefaults = fieldDefaults;
  }

  return out;
}

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

  for (const id of Object.keys(merged)) {
    merged[id] = normalizeEntityType(merged[id]);
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
