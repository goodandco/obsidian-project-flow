# CR-6: Unified `fields` Schema for Entity Types

## Context

Entity types currently use three separate flat mechanisms to describe their fields:
- `requiredFields: string[]`
- `indexField: string`
- `fieldDescriptions: Record<string, string>`

This forces the AI agent to mentally join them and provides no place for type info, constraints, or reference resolution hints. The goal is a unified `fields: Record<string, EntityFieldSchema>` map modelled after OpenAPI properties — one self-contained entry per field — while keeping full backward compatibility for user-defined entity types.

---

## Files to Modify

| File | Change |
|---|---|
| `src/interfaces.ts` | Add `EntityFieldSchema`, add `fields?` to `EntityType` |
| `src/core/registry-defaults.ts` | Migrate `task` and `lesson` to use `fields` |
| `src/core/registry-merge.ts` | Add bidirectional normalization pass |
| `src/core/settings-schema.ts` | Bump schema version 15 → 16 |
| `src/ai/adapters/registry.ts` | Read from `fields` to build tool schemas |
| `src/ai/domain/prompts.ts` | Read from `fields` for prompt context, update learning instructions |
| `src/ui/entity-create-modal.ts` | Parent type selector + folder picker for `parentFolder` fields |

**No new files needed.**

---

## Step 1 — `src/interfaces.ts`

Add **before** the `EntityType` interface:

```ts
export interface EntityFieldSchema {
  type: "string" | "number" | "boolean" | "date" | "reference";
  required?: boolean;
  enum?: string[];
  default?: string | number | boolean;
  role?: "title" | "index" | "parentFolder";
  description?: string;
  example?: string;
  refersTo?: {
    kind: "entity" | "project" | "folder";
    entityType?: string;
  };
  resolveHint?: string;
  /**
   * For role: "parentFolder" only.
   * Lists which entity types (by id) or "project" are valid parent targets.
   * Used by the AI agent to filter listProjectFiles results to relevant folders.
   * Examples: ["module", "project"], ["module", "lesson", "project"]
   */
  allowedParents?: string[];
}
```

Add to the existing `EntityType` interface:

```ts
fields?: Record<string, EntityFieldSchema>;
```

Keep `requiredFields`, `indexField`, `fieldDescriptions`, `fieldDefaults` as-is (used by entity-create-modal and entity-service; the backward pass in registry-merge derives them from `fields`).

---

## Step 2 — `src/core/registry-defaults.ts`

All 16 built-in entity types are migrated to `fields`. Remove `requiredFields`, `indexField`, `fieldDescriptions`, and `fieldDefaults` from every migrated definition (the normalization backward pass derives them for backward compat).

### Operational entities

**`task`** (from CR spec, with `${module}` fix — actually keep as spec states):
```ts
fields: {
  title:       { type: "string", required: true, role: "title" },
  description: { type: "string", required: true },
  taskIndex:   { type: "number", role: "index" },
  sprint: {
    type: "reference", required: true,
    refersTo: { kind: "entity", entityType: "sprint" },
    description: "The sprint this task belongs to.",
    resolveHint: "Call listProjectFiles with subfolder='Work/Sprints'; use the filename without .md."
  }
}
```

**`meeting.planning`, `meeting.refinement`, `meeting.retro`, `meeting.demo`, `meeting.daily`, `meeting.knowledge`** (all identical):
```ts
fields: {
  title: { type: "string", required: true, role: "title" }
}
```

**`sprint`** — migrate `fieldDescriptions.title` and `fieldDefaults` into `fields`:
```ts
fields: {
  title: {
    type: "string", required: true, role: "title",
    description: "Short sprint identifier only — e.g. '1', '2', 'Q1 2024', 'March Week 1'. Do NOT include the project name or the word 'Sprint'."
  },
  startedAt:  { type: "date", default: "today" },
  finishedAt: { type: "date", default: "today+14d" }
}
```

**`idea`**:
```ts
fields: {
  title: { type: "string", required: true, role: "title" }
}
```

**`reference` (operational)**:
```ts
fields: {
  title: { type: "string", required: true, role: "title" }
}
```

### Learning entities

**`module`**:
```ts
fields: {
  title: { type: "string", required: true, role: "title" }
}
```

**`lesson`** — keep `targetFolder` as `${parentFolder}/Lessons/${title}` (no change). `parentFolder` must point to a **module** folder or the project root:
```ts
// targetFolder stays: "${parentFolder}/Lessons/${title}"
fields: {
  title: { type: "string", required: true, role: "title" },
  parentFolder: {
    type: "string", required: true, role: "parentFolder",
    allowedParents: ["module", "project"],
    description: "Existing folder path within the project. Use a module folder (e.g. 'Modules/Module 1 - Intro') or '' for project root. Call listProjectFiles with subfolder='Modules' to discover available folders. The system automatically appends /Lessons/{title}."
  }
}
```

**`note`** — `parentFolder` can point to a module, lesson, project root, assignment, or review folder:
```ts
fields: {
  title: { type: "string", required: true, role: "title" },
  parentFolder: {
    type: "string", required: true, role: "parentFolder",
    allowedParents: ["module", "lesson", "project", "assignment", "review"],
    description: "Existing folder path within the project. Call listProjectFiles with subfolder='Modules' to discover available folders. Use '' for project root."
  }
}
```

**`assignment`** — `parentFolder` can point to a module, lesson, or project root:
```ts
fields: {
  title: { type: "string", required: true, role: "title" },
  parentFolder: {
    type: "string", required: true, role: "parentFolder",
    allowedParents: ["module", "lesson", "project"],
    description: "Existing folder path within the project. Call listProjectFiles with subfolder='Modules' to discover available folders. Use '' for project root."
  }
}
```

**`review`** — `parentFolder` can point to a project root, module, lesson, or assignment folder:
```ts
fields: {
  title: { type: "string", required: true, role: "title" },
  parentFolder: {
    type: "string", required: true, role: "parentFolder",
    allowedParents: ["project", "module", "lesson", "assignment"],
    description: "Existing folder path within the project. Call listProjectFiles with subfolder='Modules' to discover available folders. Use '' for project root."
  }
}
```

**`reference` (learning)**:
```ts
fields: {
  title: { type: "string", required: true, role: "title" }
}
```

---

## Step 3 — `src/core/registry-merge.ts`

Add a `normalizeEntityType()` helper and call it inside `mergeEntityTypes()`.

**No forward pass needed.** All built-in entity types are migrated to `fields` in Step 2. There are no real user-defined legacy types to synthesize from.

**Backward pass only** (fields → legacy): derive legacy properties so existing consumers (`entity-service`, `entity-create-modal`) continue working without changes:
- Skip `role: "index"` fields — auto-generated, excluded from `requiredFields`
- `role: "parentFolder"` fields **are included** in `requiredFields` — the agent must pass the value; exclusion from the user-facing planner summary is handled separately by `AGENT_RESOLVED_FIELDS` in `prompts.ts`
- Collect keys where `required: true` → set `requiredFields`
- Find key with `role: "index"` → set `indexField`
- Collect keys where `description` is set → set `fieldDescriptions` (needed by entity-create-modal to show hints)
- Collect keys where `default` is set → set `fieldDefaults` (needed by entity-service's `resolveFieldDefaults`)

```ts
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
```

Call `normalizeEntityType(merged[id])` for each id at the end of the merge loop in `mergeEntityTypes()`.

---

## Step 4 — `src/core/settings-schema.ts`

Bump `CURRENT_SETTINGS_SCHEMA_VERSION` from `15` to `16`.

Add a v16 block in `migrateSettings()`:

```ts
// v16: unified fields schema (normalization handled at runtime in registry-merge)
// No data migration needed — registry-merge synthesizes fields from legacy at read time.
```

**Do NOT delete or reset `learning`/`operational` from `projectTypes`** — consistent with the standing rule in memory.

---

## Step 5 — `src/ai/adapters/registry.ts` (lines ~262–295)

Replace the `requiredFields`-based tool schema builder with a `fields`-based one.

Also **remove the `module` entry from `FIELD_DESCRIPTIONS`** — its description (*"last segment of parentFolder"*) is stale and conflicts with the new model. Migrated entity types carry their own field-level `description`, so the fallback is no longer needed for `module`.

```ts
// All migrated entity types use fields; legacy fallback kept for any user-defined types
if (entityType.fields && Object.keys(entityType.fields).length > 0) {
  for (const [key, schema] of Object.entries(entityType.fields)) {
    if (schema.role === "index") continue; // auto-generated, not user-supplied

    // Build description: field description, then resolveHint (intentionally used as
    // the agent instruction string), then generic fallback.
    // For parentFolder fields, append allowedParents so the agent knows which folder
    // types are valid targets.
    let desc = schema.description ?? schema.resolveHint ?? FIELD_DESCRIPTIONS[key];
    if (schema.role === "parentFolder" && schema.allowedParents?.length) {
      desc = `${desc ?? ""} Allowed parent types: ${schema.allowedParents.join(", ")}.`.trim();
    }

    propFields[key] = {
      type: schema.type === "number" ? "number" : "string",
      ...(desc ? { description: desc } : {}),
      ...(schema.enum ? { enum: schema.enum } : {}),
    };
    if (schema.required) required.push(key);
  }
} else if (entityType.requiredFields) {
  // Legacy fallback (user-defined entity types that have not adopted fields)
  for (const field of entityType.requiredFields) {
    const description = entityType.fieldDescriptions?.[field] ?? FIELD_DESCRIPTIONS[field];
    propFields[field] = { type: "string", ...(description ? { description } : {}) };
    required.push(field);
  }
}
```

---

## Step 6 — `src/ai/domain/prompts.ts`

### `getEntityRequirementsSummary()` and `getEntityRequirementsSummaryForProject()`

Replace the current logic that reads `def.requiredFields` with one that reads `def.fields`. Keep `AGENT_RESOLVED_FIELDS = new Set(["parentFolder"])` unchanged — it filters `parentFolder` from the planner's user-facing summary (the user doesn't supply it; the agent resolves it via `listProjectFiles`).

```ts
// For each entity, summarize field roles for the planner
const typeSummary: Record<string, Record<string, string>> = {};
for (const [id, def] of Object.entries(registry)) {
  if (!def?.fields) continue;
  const fieldSummary: Record<string, string> = {};
  for (const [key, schema] of Object.entries(def.fields)) {
    if (schema.role === "index") {
      fieldSummary[key] = "auto-index";
      continue;
    }
    // Exclude agent-resolved fields from user-facing planner summary
    if (AGENT_RESOLVED_FIELDS.has(key)) continue;
    if (schema.type === "reference" && schema.refersTo?.entityType) {
      fieldSummary[key] = `reference:${schema.refersTo.entityType}`;
    } else {
      fieldSummary[key] = schema.required ? "required" : "optional";
    }
  }
  if (Object.keys(fieldSummary).length > 0) typeSummary[id] = fieldSummary;
}
```

### Specialized system prompt learning instructions (lines ~118–148)

Replace the current hardcoded lesson/parentFolder rules with instructions derived from `allowedParents`. The new approach:

1. For each entity type with a `role: "parentFolder"` field that has `allowedParents`, emit a rule line listing which folder types are valid.
2. Remove the hardcoded `"module"` field references — lesson still uses `parentFolder`.
3. Keep the `listProjectFiles` call requirement.

Replace the current learning instructions block with:

```
LEARNING PROJECT STRUCTURE:
This project uses deeply nested folders. Module folders live under Modules/. Lesson folders live under Modules/{moduleTitle}/Lessons/.

Folder layout:
  Modules/{moduleTitle}/                                              ← module folder
  Modules/{moduleTitle}/{moduleTitle}.md                             ← module file
  Modules/{moduleTitle}/Lessons/{lessonTitle}/                       ← lesson folder
  Modules/{moduleTitle}/Lessons/{lessonTitle}/{lessonTitle}.md       ← lesson file

CRITICAL RULE — parentFolder:
  parentFolder MUST be the EXACT existing folder path from the project root.
  You MUST call listProjectFiles (with subfolder='Modules') BEFORE creating any lesson, note, assignment, or review.
  Use the returned folder paths verbatim as parentFolder. Never construct the path from the title alone.

  Allowed parentFolder targets per entity type (from the fields schema):
  - createLesson:     module folder or project root (e.g. 'Modules/Module 1 - Intro' or '')
  - createNote:       module, lesson, project root, assignment, or review folder
  - createAssignment: module, lesson, or project root
  - createReview:     project root, module, lesson, or assignment folder

  LESSON parentFolder (CRITICAL):
  parentFolder for a lesson = the MODULE folder (e.g. 'Modules/Module 1 - Intro').
  The system AUTOMATICALLY appends /Lessons/{title} to place the lesson inside the Lessons subfolder.
  NEVER pass a Lessons subfolder (e.g. 'Modules/Module 1 - Intro/Lessons') as parentFolder for a lesson.

  parentFolder examples (after calling listProjectFiles):
  - '' (empty string) → course-level, entities go to root Notes/, Assignments/, Reviews/
  - 'Modules/Module 1 - Intro' → module-level (USE THIS for createLesson)
  - 'Modules/Module 1 - Intro/Lessons/Lesson 1 - Intro' → lesson-level (for notes/assignments/reviews inside a lesson)
```

**Note**: the "Allowed parentFolder targets" block above mirrors the `allowedParents` values from the `fields` schema. If entity types are added or their `allowedParents` change in `registry-defaults.ts`, update this block to match.

---

## Step 7 — `src/ui/entity-create-modal.ts`

### Goal

When an entity type has a `parentFolder` field (detected via `et.fields?.[key]?.role === "parentFolder"`) with `allowedParents`, replace the raw text input with a two-stage picker:

1. **Parent type dropdown** — lists the allowed parent types (from `allowedParents`), with `"project"` preselected as the default.
2. **Folder picker dropdown** — shown only when the selected parent type is not `"project"`. Lists discovered folders of that type within the project.

When `"project"` is selected, `parentFolder` resolves to `""` (empty string), which places the entity in the root-level directory as defined by its `targetFolder` template (e.g., `${parentFolder}/Notes` → `Notes/`).

---

### Label mapping for parent types

Map `allowedParents` string values to human-readable dropdown labels:

| `allowedParents` value | Displayed label |
|---|---|
| `"project"` | `Project (root level)` |
| `"module"` | `Module` |
| `"lesson"` | `Lesson` |
| `"assignment"` | `Assignment` |
| `"review"` | `Review` |

---

### Field rendering changes

In `onOpen()`, when building `fieldKeys`, skip `parentFolder` if it has `role: "parentFolder"` in `et.fields`. Handle it separately after the normal field loop.

```ts
// After the normal field rendering loop:
const parentFolderSchema = et.fields
  ? Object.entries(et.fields).find(([, s]) => s.role === "parentFolder")?.[1]
  : undefined;
const parentFolderKey = et.fields
  ? Object.entries(et.fields).find(([, s]) => s.role === "parentFolder")?.[0]
  : undefined;

if (parentFolderSchema && parentFolderKey && parentFolderSchema.allowedParents?.length) {
  this.renderParentFolderPicker(body, parentFolderKey, parentFolderSchema);
}
```

---

### `renderParentFolderPicker()` method

```ts
private renderParentFolderPicker(
  container: HTMLElement,
  fieldKey: string,
  schema: EntityFieldSchema,
): void {
  const allowedParents = schema.allowedParents!;
  const LABELS: Record<string, string> = {
    project: "Project (root level)",
    module: "Module",
    lesson: "Lesson",
    assignment: "Assignment",
    review: "Review",
  };

  // Type selector
  const typeWrapper = container.createDiv({ cls: "pf-ecm-field" });
  const typeLabel = typeWrapper.createEl("label", {
    cls: "pf-ecm-label",
    text: "Parent type *",
  });
  const typeSelect = typeWrapper.createEl("select", { cls: "pf-ecm-input" });
  typeLabel.setAttribute("for", `pf-ecm-field-parentType`);
  typeSelect.id = `pf-ecm-field-parentType`;

  for (const pt of allowedParents) {
    const opt = typeSelect.createEl("option", { value: pt, text: LABELS[pt] ?? pt });
    if (pt === "project") opt.selected = true;
  }

  // Folder picker (hidden when "project" selected)
  const folderWrapper = container.createDiv({ cls: "pf-ecm-field" });
  const folderLabel = folderWrapper.createEl("label", {
    cls: "pf-ecm-label",
    text: "Parent folder *",
  });
  const folderSelect = folderWrapper.createEl("select", { cls: "pf-ecm-input" });
  folderLabel.setAttribute("for", `pf-ecm-field-${fieldKey}`);
  folderSelect.id = `pf-ecm-field-${fieldKey}`;
  folderWrapper.style.display = "none"; // hidden initially (project is default)

  // Register a synthetic getter so handleSubmit reads parentFolder correctly.
  // Use a hidden input element for compatibility with this.fieldInputs (Map<string, HTMLInputElement|...>).
  const hidden = container.createEl("input", { attr: { type: "hidden", value: "" } });
  hidden.id = `pf-ecm-field-${fieldKey}-hidden`;
  this.fieldInputs.set(fieldKey, hidden);

  const refresh = async (parentType: string) => {
    if (parentType === "project") {
      folderWrapper.style.display = "none";
      hidden.value = ""; // empty string = project root
      return;
    }
    folderWrapper.style.display = "";
    folderSelect.empty();
    const folders = await this.discoverFolders(parentType);
    if (folders.length === 0) {
      folderSelect.createEl("option", { value: "", text: "(no folders found)" });
      hidden.value = "";
    } else {
      for (const f of folders) {
        folderSelect.createEl("option", { value: f, text: f });
      }
      hidden.value = folders[0];
    }
    folderSelect.addEventListener("change", () => { hidden.value = folderSelect.value; });
  };

  typeSelect.addEventListener("change", () => refresh(typeSelect.value));
  // Initialize with default (project)
  void refresh(allowedParents.includes("project") ? "project" : allowedParents[0]);
}
```

---

### `discoverFolders()` method

Scans the vault for folders that belong to the given parent type, filtered to the current project root.

```ts
private async discoverFolders(parentType: string): Promise<string[]> {
  const projectPath = this.getProjectPath();
  if (!projectPath) return [];

  // Folder patterns per parent type (relative to project root)
  const patterns: Record<string, (f: string) => boolean> = {
    module: (rel) => /^Modules\/[^/]+$/.test(rel),
    lesson: (rel) => /^Modules\/[^/]+\/Lessons\/[^/]+$/.test(rel),
    assignment: (rel) => /^(Modules\/[^/]+\/Lessons\/[^/]+\/)?Assignments\/[^/]+$/.test(rel),
    review: (rel) => /^(Modules\/[^/]+\/Lessons\/[^/]+\/)?Reviews\/[^/]+$/.test(rel),
  };

  const matcher = patterns[parentType];
  if (!matcher) return [];

  const results: string[] = [];
  for (const f of this.plugin.app.vault.getAllLoadedFiles()) {
    if (!(f as any).children) continue; // only TFolder
    if (!f.path.startsWith(projectPath + "/")) continue;
    const rel = f.path.slice(projectPath.length + 1);
    if (matcher(rel)) results.push(rel);
  }
  return results.sort();
}

private getProjectPath(): string | null {
  // Walk projectRecords to find the project's full vault path
  const pr = this.plugin.settings.projectRecords;
  for (const dim of Object.values(pr)) {
    for (const cat of Object.values(dim as any)) {
      const rec = (cat as any)[this.projectEntry.projectId];
      if (rec?.info?.path) return rec.info.path as string;
    }
  }
  return null;
}
```

---

### Validation exception

`parentFolder = ""` is a valid value (project root). In `handleSubmit`, skip the empty-string check for `parentFolder`:

```ts
// In the validation loop:
if (!input || (input.value.trim() === "" && key !== "parentFolder")) {
  // mark error ...
}
```

---

### Skip `parentFolder` in normal field loop

Before the loop over `fieldKeys`, filter out `parentFolder` keys that have `role: "parentFolder"` in `et.fields` — the two-stage picker handles them:

```ts
const parentFolderKeys = new Set(
  Object.entries(et.fields ?? {})
    .filter(([, s]) => s.role === "parentFolder")
    .map(([k]) => k)
);
// In the loop:
const fieldKeys = deduped.filter((k) => !parentFolderKeys.has(k));
```

---

## Normalization Pass — Complete Call Flow

```
mergeProjectTypes()
  └── starts with DEFAULT_PROJECT_TYPES, deep-merges user overrides

mergeEntityTypes(projectTypes, projectTypeId?)
  └── for each merged entity:
        normalizeEntityType(entity)
          └── backward pass only: derive requiredFields / indexField / fieldDescriptions / fieldDefaults
                                  from fields (all built-in types have fields)
```

All downstream consumers (entity-service, entity-create-modal, AI registry, AI prompts) receive a fully normalized entity type with both `fields` and legacy properties populated.

---

## Verification

1. **Build**: `npm run build` — must compile without TypeScript errors
2. **Tests**: `npm test` — existing tests must pass
3. **Task creation via AI**: create a task; verify `taskIndex` auto-increments, `sprint` resolveHint appears in the tool schema description
4. **Lesson creation via AI**: create a lesson; verify agent uses `parentFolder` pointing to a module folder (e.g. `Modules/Module 1 - Intro`) and file lands in `Modules/{module}/Lessons/{title}/`
5. **Note/assignment/review via AI**: verify agent is guided by `allowedParents` to pick an appropriate folder; verify it calls `listProjectFiles` before choosing `parentFolder`
6. **Entity create modal — task**: open modal; `taskIndex` not shown (role: index); all other required fields present
7. **Entity create modal — lesson**: open modal; normal `parentFolder` text input is absent; parent type dropdown shows `Module` and `Project (root level)` options; `Project (root level)` is preselected; switching to `Module` reveals a folder picker listing discovered module folders; selecting a folder sets `parentFolder` to that path; creating with `Project (root level)` sets `parentFolder = ""`
8. **Entity create modal — note/assignment/review**: same two-stage picker; all `allowedParents` appear as type options; folder picker populates for non-project types
9. **Root-level placement**: create a note with parent type = `Project (root level)`; file must land in `{projectRoot}/Notes/` (targetFolder `${parentFolder}/Notes` → `Notes/`)
10. **Backward-compat derivation**: confirm `entity-service` and `entity-create-modal` work for all migrated entity types (requiredFields, fieldDescriptions, fieldDefaults correctly derived from fields)
