import type { ProjectFlowSettings } from "../interfaces";
import { DEFAULT_PROJECT_TYPES } from "./registry-defaults";

export const CURRENT_SETTINGS_SCHEMA_VERSION = 19;

const DEFAULT_MIXED_OFFER_TEXT = "I can also set this up for you. Shall I proceed?";

export interface VersionedSettings extends ProjectFlowSettings {
  schemaVersion?: number;
}

export function migrateSettings(input: Partial<VersionedSettings> | undefined): VersionedSettings {
  const s: VersionedSettings = {
    dimensions: (input?.dimensions as any) ?? [],
    projectsRoot: input?.projectsRoot ?? "1. Projects",
    archiveRoot: (input as any)?.archiveRoot ?? "4. Archive",
    templatesRoot: (input as any)?.templatesRoot ?? "Templates/ProjectFlow",
    ai: (input as any)?.ai,
    schemaVersion: input?.schemaVersion ?? 0,
    projectRecords: {} as any,
    archivedRecords: (input as any)?.archivedRecords ?? ({} as any),
    projectTypes: (input as any)?.projectTypes ?? ({} as any),
    projectIndex: (input as any)?.projectIndex,
    projectGraph: (input as any)?.projectGraph,
  } as any;

  // Normalize projectRecords to nested map
  const pr = (input as any)?.projectRecords;
  if (pr && typeof pr === "object" && !Array.isArray(pr)) {
    s.projectRecords = pr as any;
  } else if (Array.isArray(pr)) {
    const migrated: Record<string, Record<string, Record<string, any>>> = {};
    for (const rec of pr) {
      if (!rec || !rec.info) continue;
      const d = rec.info.dimension;
      const c = rec.info.category;
      const id = rec.info.id;
      if (!d || !c || !id) continue;
      migrated[d] = migrated[d] || {};
      migrated[d][c] = migrated[d][c] || {};
      migrated[d][c][id] = rec;
    }
    s.projectRecords = migrated as any;
  } else {
    s.projectRecords = {} as any;
  }

  // Migrate dimensions from name-with-order to structured { name, order }
  if (Array.isArray(s.dimensions)) {
    let orderCounter = 1;
    s.dimensions = (s.dimensions as any[]).map((d: any) => {
      if (d && typeof d === "object") {
        let name = d.name ?? "";
        let order = d.order;
        const m = typeof name === "string" ? name.match(/^\s*(\d+)\.\s*(.+)$/) : null;
        if (m) {
          order = parseInt(m[1], 10);
          name = m[2];
        }
        if (order == null || Number.isNaN(order)) {
          order = orderCounter++;
        }
        return { name, order, categories: Array.isArray(d.categories) ? d.categories : [] };
      }
      return { name: String(d ?? ""), order: orderCounter++, categories: [] };
    }) as any;
  } else {
    s.dimensions = [] as any;
  }

  // Normalize order to be 1..n unique
  const sorted = [...(s.dimensions as any[])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((d, i) => {
    d.order = i + 1;
  });
  s.dimensions = sorted as any;

  if (!s.schemaVersion || s.schemaVersion < CURRENT_SETTINGS_SCHEMA_VERSION) {
    if (!s.projectTypes || Object.keys(s.projectTypes as any).length === 0) {
      s.projectTypes = DEFAULT_PROJECT_TYPES as any;
    }

    // v10–v11: reset stale learning/operational project types
    // Guard with `input != null` so fresh installs (null input) keep the defaults just set above.
    if (input != null && (!s.schemaVersion || s.schemaVersion < 11)) {
      if (s.projectTypes) {
        delete (s.projectTypes as any).learning;
        delete (s.projectTypes as any).operational;
      }
    }

    // v12: strip stale projectTemplates
    if (!s.schemaVersion || s.schemaVersion < 12) {
      if (s.projectTypes && typeof s.projectTypes === "object") {
        for (const pt of Object.values(s.projectTypes as any)) {
          if (pt && typeof pt === "object") delete (pt as any).projectTemplates;
        }
      }
    }

    // v13: migrate legacy settings.entityTypes into projectTypes[id].projectEntities
    if (!s.schemaVersion || s.schemaVersion < 13) {
      const legacyEntityTypes = (input as any)?.entityTypes;
      if (legacyEntityTypes && typeof legacyEntityTypes === "object") {
        s.projectTypes = s.projectTypes ?? ({} as any);
        for (const [typeId, registry] of Object.entries(legacyEntityTypes as Record<string, any>)) {
          if (!registry || typeof registry !== "object") continue;
          const pt = (s.projectTypes as any)[typeId];
          if (pt && typeof pt === "object") {
            pt.projectEntities = { ...(pt.projectEntities ?? {}), ...registry };
          }
        }
      }
      // Reset all project types so defaults (with projectEntities) are picked up fresh.
      // Guard with `input != null` so fresh installs keep the defaults just set above.
      if (input != null && s.projectTypes) {
        delete (s.projectTypes as any).operational;
        delete (s.projectTypes as any).learning;
      }
    }

    // v14: add pinnedProjects
    if (!s.schemaVersion || s.schemaVersion < 14) {
      (s as any).pinnedProjects = (input as any)?.pinnedProjects ?? [];
    }

    // v16: unified fields schema (normalization handled at runtime in registry-merge)
    // No data migration needed — registry-merge synthesizes legacy props from fields at read time.

    // v19: learning project type folderStructure simplified (removed Notes/Assignments/Reviews/Resources
    // root folders) and initialNotes updated (Knowledge Base → Overview, References moved to root,
    // ReadingList removed). Reset stored values so updated defaults are used.
    if (!s.schemaVersion || s.schemaVersion < 19) {
      const storedLearning = (s.projectTypes as any)?.learning;
      if (storedLearning && typeof storedLearning === "object") {
        delete storedLearning.folderStructure;
        delete storedLearning.initialNotes;
      }
    }

    // v18: parentFolder fields on learning entity types changed from type:"string" to
    // type:"reference" ($dynamic). Reset the four affected built-in entities so the
    // updated field schema is picked up from defaults. Preserves any other learning
    // project type customisations (folder structure, custom entity types, etc.).
    if (!s.schemaVersion || s.schemaVersion < 18) {
      const learningEntities = (s.projectTypes as any)?.learning?.projectEntities;
      if (learningEntities && typeof learningEntities === "object") {
        for (const entityId of ["lesson", "note", "assignment", "review"]) {
          delete learningEntities[entityId];
        }
      }
    }

    // v17: merge missing folderStructure entries and initialNotes from defaults into stored
    // operational project type (additive only — preserves any user customisations)
    if (!s.schemaVersion || s.schemaVersion < 17) {
      const defaultOp = DEFAULT_PROJECT_TYPES.operational;
      const storedOp = (s.projectTypes as any)?.operational;
      if (storedOp && defaultOp) {
        const existingFolders = new Set<string>(storedOp.folderStructure ?? []);
        for (const folder of defaultOp.folderStructure ?? []) {
          if (!existingFolders.has(folder)) {
            storedOp.folderStructure = [...(storedOp.folderStructure ?? []), folder];
            existingFolders.add(folder);
          }
        }
        const existingNotes = new Set<string>(
          (storedOp.initialNotes ?? []).map((n: any) => n.fileName),
        );
        for (const note of defaultOp.initialNotes ?? []) {
          if (!existingNotes.has(note.fileName)) {
            storedOp.initialNotes = [...(storedOp.initialNotes ?? []), note];
            existingNotes.add(note.fileName);
          }
        }
      }
    }

    if (!s.ai) {
      s.ai = {
        enabled: false,
        provider: "openai",
        apiKeySecretName: "",
        model: "gpt-4o-mini",
        baseUrl: "https://api.openai.com",
        strictExecution: false,
        memoryLimit: 10,
        mixedOfferText: DEFAULT_MIXED_OFFER_TEXT,
        mcpServers: [],
      } as any;
    } else {
      s.ai = {
        enabled: Boolean((s.ai as any).enabled),
        provider: ((s.ai as any).provider || "openai") as any,
        apiKeySecretName: (s.ai as any).apiKeySecretName ?? "",
        model: (s.ai as any).model ?? "gpt-4o-mini",
        baseUrl: (s.ai as any).baseUrl ?? "https://api.openai.com",
        strictExecution: Boolean((s.ai as any).strictExecution),
        memoryLimit: Number.isFinite((s.ai as any).memoryLimit) ? (s.ai as any).memoryLimit : 10,
        mixedOfferText: (s.ai as any).mixedOfferText ?? DEFAULT_MIXED_OFFER_TEXT,
        mcpServers: Array.isArray((s.ai as any).mcpServers) ? (s.ai as any).mcpServers : [],
      } as any;
    }
    s.schemaVersion = CURRENT_SETTINGS_SCHEMA_VERSION;
  }
  return s;
}
