---

## Task: Enrich entity type field definitions with a unified `fields` schema

### Background

Entity types currently describe their fields through three separate flat mechanisms:

- `requiredFields: string[]` — which fields are mandatory
- `indexField: string` — which field holds an auto-incremented index
- `fieldDescriptions: Record<string, string>` — freeform prose hints per field

This is fragmented and forces the AI agent to mentally join them together per field. There is no place to encode type, constraints, or reference resolution hints in a structured way.

---

### Goal

Replace the three mechanisms with a unified `fields` map modelled after OpenAPI's `properties` — one entry per field, self-contained. Keep `targetFolder` as a `${VAR}` template string, but field names in it must match actual field keys (e.g. `${module}` not `${parentFolder}`).

---

### New interfaces

Add to `src/interfaces.ts`:

```ts
interface EntityFieldSchema {
  // Core type
  type: "string" | "number" | "boolean" | "date" | "reference";
  required?: boolean; // replaces requiredFields membership

  // Value constraints
  enum?: string[]; // allowed values
  default?: string | number | boolean;

  // Special roles
  role?: "title" | "index" | "parentFolder"; // replaces indexField

  // AI / UI hints
  description?: string; // replaces fieldDescriptions entry
  example?: string;

  // For type: "reference" — what this field points to
  refersTo?: {
    kind: "entity" | "project" | "folder";
    entityType?: string; // required when kind === "entity"
  };
  resolveHint?: string; // fallback prose hint for AI when refersTo is insufficient
}
```

Update `EntityTypeDefinition` in `src/interfaces.ts`:

```ts
interface EntityTypeDefinition {
  id: string;
  name: string;
  templatePath: string;
  targetFolder: string; // ${VAR} template — vars must match field keys
  filenameRule: string;
  patchMarkers?: string[];
  childFolders?: string[];

  // NEW
  fields?: Record<string, EntityFieldSchema>;

  // DEPRECATED — keep for backward compat, see migration below
  requiredFields?: string[];
  indexField?: string;
  fieldDescriptions?: Record<string, string>;
}
```

---

### Migration strategy

In `src/core/registry-merge.ts`, add a normalization pass that runs after merging. If `fields` is absent on an entity type, synthesize it from the legacy trio so the rest of the codebase always reads from `fields`:

1. Each entry in `requiredFields` → sets `required: true` on that field
2. `indexField` value → sets `role: "index"` on that field
3. Each entry in `fieldDescriptions` → maps to `description` on that field

This means no existing definitions break, and new definitions can use `fields` exclusively.

Bump `CURRENT_SETTINGS_SCHEMA_VERSION` in `src/core/settings-schema.ts` and add a migration step.

---

### Update built-in entity types

Migrate definitions in `src/core/registry-defaults.ts` to use `fields`. Remove `requiredFields`, `indexField`, and `fieldDescriptions` from migrated definitions.

**Task entity:**

```ts
{
  id: "task",
  name: "Task",
  templatePath: "operational/template-task.md",
  targetFolder: "Work/Tasks",
  filenameRule: "${PROJECT_ID}-${taskIndex}-${title}",
  patchMarkers: ["AI:CONTENT", "AI:ACTIONS"],

  fields: {
    title:       { type: "string", required: true, role: "title" },
    description: { type: "string", required: true },
    taskIndex:   { type: "number", role: "index" },
    sprint: {
      type: "reference",
      required: true,
      refersTo: { kind: "entity", entityType: "sprint" },
      description: "The sprint this task belongs to.",
      resolveHint: "Call listProjectFiles with subfolder='Work/Sprints'; use the filename without .md."
    }
  }
}
```

**Lesson entity:**

```ts
{
  id: "lesson",
  name: "Lesson",
  templatePath: "learning/template-lesson.md",
  targetFolder: "${module}/Lessons/${title}",
  filenameRule: "${title}",
  patchMarkers: ["AI:CONTENT", "AI:NOTES", "AI:SUMMARY"],
  childFolders: ["Notes", "Assignments", "Reviews"],

  fields: {
    title: {
      type: "string",
      required: true,
      role: "title"
    },
    module: {
      type: "reference",
      required: true,
      refersTo: { kind: "entity", entityType: "module" },
      description: "The module this lesson belongs to."
    }
  }
}
```

Note: `${module}` in `targetFolder` resolves to the folder path of the referenced module entity. The variable name matches the field key exactly.

---

### Update the AI module

In `src/ai/` (planner and specialized agent system prompt construction):

- Iterate `fields` instead of joining `requiredFields` + `fieldDescriptions` + `indexField` separately
- For `type: "reference"` fields with `refersTo.kind === "entity"`: instruct the agent to list entities of `refersTo.entityType` to resolve the value
- For `role: "index"` fields: instruct the agent that this value is auto-assigned, not user-supplied
- For `targetFolder` containing `${VAR}` where `VAR` is a `reference` field: instruct the agent that resolving that field also determines the placement path — no separate folder input needed

---

### Affected files

| File                                     | Change                                                 |
| ---------------------------------------- | ------------------------------------------------------ |
| `src/interfaces.ts`                      | Add `EntityFieldSchema`, update `EntityTypeDefinition` |
| `src/core/registry-defaults.ts`          | Migrate built-in entity types to `fields`              |
| `src/core/registry-merge.ts`             | Add normalization pass (legacy → `fields`)             |
| `src/core/settings-schema.ts`            | Bump schema version, add migration step                |
| `src/ai/`                                | Read `fields` when building agent system prompts       |
| `references/entity-and-project-types.md` | Document new schema                                    |

---

### Out of scope

- UI for editing field schemas in the settings tab
- Runtime validation of entity values against field schema at creation time
