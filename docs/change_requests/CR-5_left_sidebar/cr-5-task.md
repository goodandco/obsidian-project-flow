# ProjectFlow — UI Implementation Task

## Purpose

This document is a specification for implementing a new UI layer in the ProjectFlow Obsidian plugin. It should be used to generate a detailed, phased implementation plan. Read it fully before planning — the sections are ordered by concept, not by build order.

---

## Background & Current State

ProjectFlow is an Obsidian plugin for structured project management. It organises projects into a hierarchical vault structure (dimensions → categories → projects → entities).

**Current UI surface:**
- 2 commands: Add Project, Remove Project (command palette only)
- 1 settings tab: folders, dimensions/categories config, AI chat toggle
- 1 right sidebar panel: AI chat (Anthropic / OpenAI / Ollama)

**Core pain points being solved:**
1. Entity management is invisible — users can only create entities via the AI chat or Templater commands. There is no direct interface.
2. Project browsing doesn't exist — users navigate their vault manually.
3. The AI chat is the only real interface. Power users and non-AI users have no alternative.

**What is NOT changing:**
- The right sidebar AI chat panel — leave it untouched
- The existing settings tab structure (Folders, Dimensions sections) — only append to it
- The Core API, services, registry system, template processor — UI must consume these, not replace them

---

## Architecture Constraints

Before planning any implementation, read the following files in the codebase:

- `src/interfaces.ts` — all key data interfaces
- `src/core/settings-schema.ts` — settings shape and `migrateSettings()`
- `src/core/registry-defaults.ts` — built-in project and entity types
- `src/core/registry-merge.ts` — `mergeProjectTypes()`, `mergeEntityTypes()` — always use these, never read `settings.projectTypes` directly
- `src/api/core-api.ts` — all vault mutations must go through this
- `src/services/` — project-service, entity-service
- `references/conventions.md` — Obsidian UI patterns, ItemView registration, CSS conventions
- `references/data-model.md` — full interface reference
- `references/entity-and-project-types.md` — how project types and entity types are structured
- `references/template-system.md` — two-template distinction (structural vs ephemeral), variable substitution, `ProjectVariables`

**Non-negotiable rules:**
- All settings changes must go through `migrateSettings()` — never read `data.json` raw
- All vault mutations (create project, create entity) must go through Core API handlers
- Never read `settings.projectTypes` or `settings.entityTypes` directly — always use registry merge functions
- Schema version must be incremented and a migration written for any settings shape change
- New UI views must be registered as Obsidian `ItemView` subclasses following existing conventions

---

## Scope of Work

One new UI surface plus one popup, in recommended build order:

1. **Left sidebar panel** — project browser with inline entity creation area (new `ItemView`)
2. **Entity creation popup** — per-ephemeral-template form, triggered from the sidebar

Project type management (wizard + settings section) is explicitly out of scope for this task — it will be a separate implementation task.

---

## 1. Left Sidebar Panel — Project Browser

### Overview

A new Obsidian `ItemView` registered on the left sidebar. View type ID: `projectflow-browser`. This is the primary daily-use surface. It replaces the need to use commands or AI chat for both project navigation and entity creation.

The sidebar has exactly three areas:
1. **Filters** — dimension tabs, category chips, project type filter, search input
2. **Project list** — paginated, with pinning and inline entity creation
3. **Footer** — "New project" button only

### Visual reference
See attached mockups: `sidebar-panel-mockup`, `projectflow_sidebar_v3`

---

### Filters

**Dimension tabs**
- Render one pill/tab per dimension from settings
- Selecting a dimension filters the project list and replaces the category chips with those belonging to the selected dimension
- "All" tab shows projects across all dimensions and clears the category filter
- Source: `plugin.settings.dimensions` via `migrateSettings()`

**Category filter chips**
- Dimensions and categories are dependent — each dimension has its own unique set of categories
- Always render only the categories belonging to the currently selected dimension
- Selecting a different dimension replaces the category chip set entirely and resets selection to "All"
- "All" chip clears the category filter within the current dimension
- Single-select only
- Source: categories nested within the selected dimension in settings

**Project type filter**
- Segmented control: "All" + one segment per project type (built-in first, then user-defined)
- Filters project list by `projectType` field on the project record
- Labels and accent colors sourced from `mergeProjectTypes(settings.projectTypes)`
- The number of types is variable — if segments overflow the panel width, make the control horizontally scrollable with scroll-snap

**Search / filter input**
- A single text input supporting three filter modes:
  - **Default (no prefix):** filters by project name, case-insensitive substring match
  - **`tag:` prefix** (e.g. `tag:frontend`): filters projects by a specific tag value in the project's frontmatter
  - **`id:` prefix** (e.g. `id:proj-42`): filters projects by their unique project ID
- Filtering is client-side and real-time
- When a `tag:` or `id:` prefix is detected, show a subtle mode indicator (e.g. "Filtering by tag")
- Clearing the input resets to the full filtered list

All four filters compose — the project list always reflects all active filters simultaneously.

---

### Project list

**General rules**
- Shows projects matching all active filters
- Archived projects are never shown
- Maximum **10 projects per page** (pinned projects are exempt)
- Pagination controls shown when filtered unpinned results exceed 10: `←` / `→` arrows with "Page N of M" label
- Page resets to 1 on any filter change; page state is in-memory only

**Each project row shows:**
- Project name
- Project type badge (colored, sourced from project type registry)
- Category label
- Entity summary: count per entity type with colored type dots

**Pinned projects**
- Up to **5 projects** can be pinned
- Pinned projects always appear at the top of the list above all unpinned results, regardless of active filters
- Each pinned row shows a visible pin marker
- Pin/unpin via a pin icon on row hover or right-click context menu
- Pinned IDs persisted to `plugin.settings.pinnedProjects`
- Stale pins (deleted/archived projects) are silently removed on panel load
- Pinned projects do not count toward the 10-project pagination limit
- Pin action disabled when 5-project limit is reached

---

### Inline entity creation area

**Trigger**
Clicking a project row toggles an expansion area that appears directly below that row. Clicking the same row again collapses it. Only one project can be expanded at a time — expanding a new project collapses the previously expanded one.

**Contents — creation buttons only**
The expanded area contains:
- A small muted label: "Create entity"
- A row of `+` buttons, one per ephemeral template defined for that project's project type

Each button shows:
- A small colored icon badge (letter abbreviation, colored per entity type)
- The button label: `+ {template name}` — e.g. `+ task`, `+ meeting demo`, `+ meeting daily`, `+ note`

**Button source**
The buttons are generated entirely from the ephemeral template definitions of the project's type. They are not hardcoded. The implementation must:
1. Resolve the project's `projectType`
2. Call `mergeProjectTypes(settings.projectTypes)` to get the full type definition
3. Read the `ephemeralTemplates` array from that type definition
4. Render one `+` button per entry, using the template's `name` as the label and `key` as the identifier

This means if a project type defines `task`, `meeting.demo`, `meeting.daily`, and `note` as ephemeral templates, exactly those four buttons appear — no more, no less. Adding a new ephemeral template to a project type automatically surfaces a new button for all projects of that type.

**No entity list, no status filters, no other content** in the expansion area — only the creation buttons.

---

### Footer

- A single "New project" button spanning the full panel width
- Opens the Project Creation Modal (see section 2)

---

### Data sources
- Dimensions and categories: `plugin.settings` via `migrateSettings()`
- Projects: `listProjects()` from Core API (`handlers/projects.ts`)
- Project types and ephemeral templates: `mergeProjectTypes(settings.projectTypes)`
- Pinned project IDs: `plugin.settings.pinnedProjects` (new field — see Schema Changes)

### CSS
Follow `references/conventions.md`. Use Obsidian CSS custom properties throughout. Do not hardcode hex colors.

---

## 2. Entity Creation Popup

### Overview

A small `Modal` subclass triggered when the user clicks a `+` button in the inline entity creation area of the sidebar. The modal knows the project and the specific ephemeral template key at the moment of opening — it does not ask the user to select a type.

### Visual reference
See attached mockup: `projectflow_sidebar_v3` (click any `+` button to see the popup)

---

### Trigger and context

When a `+` button is clicked:
- The **project** is already known (the expanded project row)
- The **ephemeral template key** is already known (the button that was clicked, e.g. `"task"`, `"meeting.demo"`)
- The modal opens immediately with the correct title and fields — no type selection step

The modal title reads: `New {template name}` — e.g. "New task", "New meeting demo".

---

### Fields

The fields rendered in the popup are driven entirely by the ephemeral template's field schema as defined in the project type definition. This is the same field schema the AI agent uses when creating entities — the UI must read and respect the same structure.

For each field defined in the ephemeral template:
- Render the appropriate input type: text input, textarea, date picker, or select/dropdown
- Use the field's label as the field label
- Use the field's placeholder if defined
- Mark required fields visually (e.g. asterisk)
- Lay out fields in a two-column grid; fields marked `span: 2` (or equivalent) span the full width

**Example field sets by template key** (these are illustrative — the actual fields come from the registry):
- `task`: name (required, full-width), description (textarea, full-width), priority (select: P0–P3), due date, assignee, sprint
- `meeting.demo`: name (required, full-width), date, attendees, demo scope (textarea, full-width)
- `meeting.daily`: name (required, full-width), date, blockers (textarea, full-width)
- `note`: name (required, full-width), tags (full-width)
- `goal`: name (required, full-width), target date, progress
- `resource`: name (required, full-width), URL (full-width), tags, source

The implementation must not hardcode these field sets. It must read them dynamically from `mergeEntityTypes(settings.entityTypes, projectTypeId)` or equivalent registry lookup for the given ephemeral template key.

---

### Submit behaviour

On "Create →":

1. Validate: name field is non-empty (minimum required field). Show inline error on the name field if empty — do not close the modal.
2. Resolve the ephemeral template:
   - Look up the project's type definition via `mergeProjectTypes(settings.projectTypes)`
   - Find the ephemeral template entry matching the key (e.g. `"task"`)
   - Locate the pre-personalised template file in the project's internal `Templates/` directory using the key
3. Call `createEntity()` from Core API (`handlers/entities.ts`), passing:
   - The resolved template path (project-level personalised copy)
   - The project reference
   - The field values from the form as frontmatter overrides
4. The entity file is created in the correct subfolder as defined by the project type's structure config
5. On success: close the modal
6. On failure: show an error message inside the modal, do not close

On "Cancel": close with no changes.

---

### Template system — entity creation path

Read `references/template-system.md` fully. The critical path for entity creation via the UI is:

1. At project creation time, ephemeral source templates (with `${VAR}` placeholders) were copied into the project's internal `Templates/` directory and personalised — project tag, paths, and other project-level variables were baked in.
2. When the user creates an entity via the popup, the system looks up the pre-personalised template in the project's `Templates/` directory by the ephemeral template **key**.
3. `createEntity()` uses that template to generate the entity file, placing it in the subfolder defined by the project type's structure config.
4. Any additional frontmatter fields collected from the form are written into the new file on top of what the template provides.

This is exactly the same resolution path the AI agent uses — the UI is a direct alternative to the AI for entity creation, not a separate system.

---

## 3. Project Creation Modal

### Overview

A `Modal` subclass opened from the "New project" button in the sidebar footer.

### Visual reference
See attached mockup: `create-project-modal`

---

### Fields

**Project type selector — horizontal scrolling row**
- One card per project type (built-in first, then user-defined), in a horizontally scrollable row
- Fixed card width (~148px) so multiple cards are visible and scroll is discoverable
- Right-edge fade hints at more cards; scroll-snap per card
- Selected card highlighted with the type's color: colored border (1.5px), tinted background, name in type color
- Selecting a card immediately updates the "Project will create" preview
- Source: `mergeProjectTypes(settings.projectTypes)`

**Project name** (required)
- As the user types, Project ID and Project Tag both auto-derive a slug (lowercase, hyphens, alphanumeric)
- Auto-derive stops per field as soon as that field is manually edited

**Project ID** (required)
- `#` prefix label fused to the left of the input (non-editable)
- Must be unique across all projects — validated on submit
- Used as the lookup key for the `id:` search filter
- Format: lowercase alphanumeric and hyphens only

**Project tag** (required)
- `#` prefix label fused to the left of the input, colored with the active project type's color
- Baked into all ephemeral templates at project creation — becomes the primary tag in Dataview queries
- Used as the lookup value for the `tag:` search filter
- Format: lowercase alphanumeric and hyphens only

**Dimension** (required)
- Dropdown populated from `plugin.settings.dimensions`
- Changing dimension immediately replaces the Category dropdown

**Category** (required)
- Dropdown populated from categories of the selected dimension only
- Always in sync with Dimension — changing dimension resets this to the first category of the new dimension

**Project will create — live preview**

Updates on every project type selection change. Three subsections:

1. **Folder structure** — monospace tree showing the vault path, using the Project ID as the folder name. Root path and internal layout sourced from the selected project type definition. Updates live as the user types.

2. **Structural files** — chips, one per structural file in the selected project type. These are the backbone files created at initialisation.

3. **Ephemeral templates** — list rows, one per ephemeral template. Each row: entity type icon badge, template name, key as a styled code badge (e.g. `task`, `meeting.demo`). Below the list: "Personalised with your project tag and paths, then stored in `Templates/` inside the project folder."

### Submit

1. Validate: name non-empty, ID non-empty and unique, tag non-empty. Inline field errors on failure, do not close.
2. Call existing project creation logic via Core API / project-service with type, ID, tag, dimension, category.
3. On success: close modal, refresh sidebar project list.

---

## Settings Schema Changes

**New field: pinned projects**
```typescript
// Added to the top-level settings object
pinnedProjects: string[]   // array of project IDs, max length 5, default []
```

Required steps:
1. Increment `CURRENT_SETTINGS_SCHEMA_VERSION`
2. Write migration in `settings-schema.ts`: add `pinnedProjects: []` for existing installs
3. Update `migrateSettings()` to apply it

---

## Implementation Order (Recommended)

**Phase 1 — Foundation**
- Read all reference files listed in Architecture Constraints
- Add `pinnedProjects: string[]` to settings schema with migration
- Register `projectflow-browser` ItemView as an empty shell; confirm it appears in the left sidebar

**Phase 2 — Sidebar: filters + project list (read-only)**
- Dimension tabs, category chips (dimension-dependent), project type filter
- Project list: fetch via `listProjects()`, render rows, exclude archived
- Pagination: 10 unpinned projects per page, reset on filter change
- Search input: name / `tag:` / `id:` modes with mode indicator
- Project rows render but clicking does nothing yet

**Phase 3 — Sidebar: pinning**
- Pin/unpin via hover icon or right-click context menu
- Persist to `settings.pinnedProjects` via `plugin.saveSettings()`
- Pinned rows at top of list with pin marker, outside pagination
- Enforce max 5; silently remove stale pins on load

**Phase 4 — Inline entity creation area**
- Clicking a project row toggles expansion area below it; only one open at a time
- Read the project's type, resolve ephemeral templates via `mergeProjectTypes()`
- Render one `+` button per ephemeral template entry (name + colored icon badge)
- Buttons are data-driven — no hardcoded entity types

**Phase 5 — Entity creation popup**
- Modal opens on `+` button click, pre-loaded with project + template key context
- Render fields dynamically from the template's field schema (same schema the AI uses)
- Two-column grid layout; full-width fields for name, description, textarea fields
- On submit: resolve project-level personalised template by key → `createEntity()` via Core API → write frontmatter fields → close on success
- Inline name validation before submit

**Phase 6 — Project creation modal**
- Horizontal scrolling type selector with color-reactive selected state
- Name → auto-slug to ID and tag (stop per field on manual edit)
- Dimension + category with dependency (changing dimension resets category)
- Live "Project will create" preview: folder tree + structural file chips + ephemeral template list
- Submit: validate → call project creation → refresh sidebar

---

## Attached Visual References

The following mockup artifacts should be attached alongside this document when prompting Claude Code:

- `references/projectflow_sidebar.html` and `references/projectflow_sidebar.png` — final sidebar mockup: filters, project list with pinned rows, inline entity creation area with `+` buttons, entity creation popup with template-driven fields
- `references/projectflow_ux_architecture.png` — architecture diagram showing surfaces and relationships
- `references/projectflow_create_project_modal.html` and `references/projectflow_create_project_modal.png` — creation modal with horizontal type scroll, name/ID/tag fields, dimension/category selectors, live preview

---

## Out of Scope (Do Not Implement)

- Project type wizard and settings section — separate task
- Custom entity type builder
- Archived projects section or any display of archived projects in the sidebar
- Any entity list, status filters, or entity browsing in the sidebar — the expanded area contains creation buttons only
- Drag-and-drop reordering
- Inline editing of project or entity names in the sidebar
- Any changes to the right sidebar AI chat panel
- Any changes to the existing Folders or Dimensions sections of the settings tab
- Graph view or canvas integrations