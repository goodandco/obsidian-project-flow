# CR-5: Left Sidebar Panel — Implementation Plan

## Context

ProjectFlow currently has no direct UI for project navigation or entity creation — users rely on the AI chat or command palette. CR-5 adds a left sidebar `ItemView` (`projectflow-browser`) that provides:
1. A filtered, searchable project browser
2. Inline entity creation buttons per project (driven by `projectEntities` from the project type registry)
3. An entity creation popup (Modal) driven by entity field schema
4. A project creation modal

This is purely additive UI — no changes to Core API, services, or the right-sidebar AI chat.

---

## Codebase Facts

- `CURRENT_SETTINGS_SCHEMA_VERSION = 13` → bump to **14**
- Only existing `ItemView`: `ProjectFlowAIChatView` in `src/ai/adapters/view.ts` — follow its patterns exactly
- View registration in `src/plugin.ts:17` via `this.registerView(TYPE, leaf => new View(leaf, this))`
- Left sidebar: `this.app.workspace.getLeftLeaf(false)` + `leaf.setViewState({ type, active: true })`
- "ephemeral templates" in task spec = `projectType.projectEntities` entries (`Record<string, EntityType>`)
- `listProjects()` returns `ProjectIndexEntry[]` (flat, includes archived — filter separately)
- Archived detection: projects in `settings.archivedRecords`, not in `settings.projectRecords`
- `createEntity(req)`: `{ projectRef: { id }, entityTypeId, fields }`
- `createProject(req)`: `CreateProjectRequest` = `ProjectInfo & { year? }`
- Entity type fields: `requiredFields: string[]`, `fieldDescriptions: Record<string,string>`, `fieldDefaults: Record<string,string>` — no explicit input-type metadata; infer from field name
- CSS: use Obsidian CSS variables throughout; class prefix `pf-browser-*`; append to `styles.css`

---

## Critical Files

| File | Change |
|------|--------|
| `src/interfaces.ts` | Add `pinnedProjects?: string[]` to `ProjectFlowSettings` |
| `src/core/settings-schema.ts` | Bump version to 14, add migration |
| `src/plugin.ts` | Register `BROWSER_VIEW_TYPE`, activate on load, update `onunload` |
| `src/ui/browser-view.ts` | **New** — main `ItemView` |
| `src/ui/entity-create-modal.ts` | **New** — entity creation `Modal` |
| `src/ui/project-create-modal.ts` | **New** — project creation `Modal` |
| `styles.css` | Append all new CSS (`.pf-browser-*` prefix) |

---

## Phase 1 — Foundation (Settings + View Shell)

### 1.1 Settings schema
- `src/interfaces.ts`: add `pinnedProjects?: string[]` to `ProjectFlowSettings`
- `src/core/settings-schema.ts`:
  - `CURRENT_SETTINGS_SCHEMA_VERSION = 14`
  - New migration block: `if (!s.schemaVersion || s.schemaVersion < 14) { s.pinnedProjects = (input as any)?.pinnedProjects ?? []; }`

### 1.2 Browser view shell
- Create `src/ui/browser-view.ts`:
  ```ts
  export const BROWSER_VIEW_TYPE = "projectflow-browser";
  export class ProjectFlowBrowserView extends ItemView { ... }
  ```
  - `getViewType()` → `BROWSER_VIEW_TYPE`
  - `getDisplayText()` → `"ProjectFlow"`
  - `getIcon()` → `"layout-list"`
  - `onOpen()` → renders placeholder `<div class="pf-browser-view">Loading…</div>`
  - `onClose()` → cleans up

### 1.3 Plugin registration
- `src/plugin.ts`:
  - Import `BROWSER_VIEW_TYPE`, `ProjectFlowBrowserView`
  - `this.registerView(BROWSER_VIEW_TYPE, leaf => new ProjectFlowBrowserView(leaf, this))`
  - In `onLayoutReady`: `this.activateBrowserView()` (unconditional — always show sidebar)
  - `activateBrowserView()`: check `getLeavesOfType`, else `getLeftLeaf(false)` → `setViewState`
  - `onunload()`: add `this.app.workspace.detachLeavesOfType(BROWSER_VIEW_TYPE)`

---

## Phase 2 — Filters + Project List (read-only)

All state is in-memory on `ProjectFlowBrowserView` instance:
```ts
private activeDimension: string | null = null;   // null = "All"
private activeCategory: string | null = null;
private activeProjectType: string | null = null;
private searchQuery: string = '';
private currentPage: number = 1;
```

### 2.1 Data loading
- `getProjectList()`: reads `plugin.settings.projectRecords` (triple-nested map), flattens to `ProjectRecord[]`, enriches via `plugin.settings.projectIndex.byId` to get `ProjectIndexEntry` fields
- Archived detection: skip any `projectId` that appears in `archivedRecords`
- Entity counts: for each project, count vault files under `projectVariables.PROJECT_PATH + '/' + entityType.targetFolder` using `plugin.app.vault.getFiles().filter(f => f.path.startsWith(...))`; grouped by entity type

### 2.2 Dimension tabs
- Source: `plugin.settings.dimensions.sort((a,b) => a.order - b.order)`
- Render "All" pill + one pill per dimension
- Click → sets `activeDimension`, resets `activeCategory`, `currentPage`, re-renders

### 2.3 Category chips
- Source: categories of `activeDimension`; if `activeDimension == null` → hide chip row
- "All" chip + one per category; single-select
- Click → sets `activeCategory`, resets `currentPage`, re-renders

### 2.4 Project type filter
- Source: `mergeProjectTypes(plugin.settings.projectTypes)` — keys ordered: built-in first (`operational`, `learning`), then user-defined
- "All" segment + one per project type (use `projectType.name`)
- If > 4 types: make row `overflow-x: auto; scroll-snap-type: x mandatory`
- Click → sets `activeProjectType`, resets `currentPage`, re-renders

### 2.5 Search input
- Detect prefix: `tag:` → filter by `projectRecord.info.tag.includes(value)`; `id:` → filter by `projectId`; no prefix → filter by `projectName` case-insensitive
- Show mode indicator label below input when `tag:` or `id:` prefix detected
- `oninput` → set `searchQuery`, reset `currentPage`, re-render

### 2.6 Project rows
Each row (`div.pf-browser-proj-row`):
- Project name (bold, truncated)
- Project type badge: abbreviation letters + bg/fg color from entity type color scheme
- Category label (muted)
- Entity summary: `<span class="pf-browser-e-dot" style="background:{color}"></span>{count}` per entity type that has files

### 2.7 Pagination
- Separate pinned list (from `settings.pinnedProjects`) from unpinned filtered list
- Pinned projects always shown at top (section label "Pinned"), not counted in pagination
- Unpinned results: slice `[(page-1)*10 : page*10]`
- Render pagination bar when unpinned count > 10: `← Page N of M →`
- Arrow click → increment/decrement `currentPage`, re-render

---

## Phase 3 — Pinning

- On load: remove stale pin IDs (not in active `projectRecords`)
- Each row shows pin icon (`.pf-browser-pin-icon`) on hover via CSS `:hover`
- Click pin icon (stop propagation) → toggle pin in `plugin.settings.pinnedProjects`, call `plugin.saveSettings()`, re-render
- Pin disabled (no-op + tooltip) when already 5 pinned and not already pinned
- Right-click context menu on row: `menu.addItem` → "Pin project" / "Unpin project" using Obsidian `Menu` API

---

## Phase 4 — Inline Entity Creation Area

- Click project row → toggles `expandedProjectId` (collapse previous, expand new)
- Expanded area (`div.pf-browser-entity-expand`) below row, left-bordered with type accent color
- Contents:
  1. Muted label "Create entity"
  2. Button row: one `+` button per `projectEntities` entry on the project's type
     - Resolve: `const projectTypeId = record.info.projectTypeId`
     - `const types = mergeProjectTypes(plugin.settings.projectTypes)`
     - `const entities = Object.values(types[projectTypeId]?.projectEntities ?? {})`
     - Each button: colored icon badge (first letter of entity name, color derived from entity id hash), label `+ {entity.name.toLowerCase()}`
- Button click → opens `EntityCreateModal` (stop row click propagation)
- `getEntityColor(entityId)`: same `hashString` approach used elsewhere in settings-tab → hue class

---

## Phase 5 — Entity Creation Popup

**`src/ui/entity-create-modal.ts`** — `class EntityCreateModal extends Modal`

Constructor args: `(app, plugin, projectEntry: ProjectIndexEntry, entityTypeId: string)`

### Field rendering
- Resolve entity type: `mergeEntityTypes(mergeProjectTypes(plugin.settings.projectTypes))[entityTypeId]`
- Derive fields to show:
  - Always start with `title` (full-width, required, text)
  - Then remaining `requiredFields` (minus `title`)
  - Then keys in `fieldDescriptions` not already in `requiredFields`
  - Field type inference by name: `description`/`notes`/`blockers`/`scope` → textarea; `date`/`startedAt`/`finishedAt`/`dueDate`/`due` → date; all else → text
- Layout: `div.popup-body` as CSS grid `1fr 1fr`; `title`, textarea fields get `grid-column: 1 / -1`
- Labels from field key (title-cased) + `fieldDescriptions[key]` as placeholder/hint
- Required fields marked with ` *`
- `fieldDefaults` pre-populated: `"today"` → `new Date().toLocaleDateString('en-GB')`, `"today+Nd"` → computed

### Validation (client-side, before submit)
- Collect all rendered input values into `formValues: Record<string, string>`
- For each field in `entityType.requiredFields`:
  - If the rendered input for that field is empty → mark it invalid (add `.pf-ecm-field-error` class to the field wrapper, append inline `<span class="pf-ecm-error-msg">Required</span>` below the input)
  - If `title` is invalid, focus it; otherwise focus the first invalid field
- If any required field is invalid → **do not submit**, return early
- On any input `oninput` → clear that field's error state immediately

### Submit
1. Run client-side validation (above); abort if invalid
2. Build `fields` from all non-empty input values (skip blanks for optional fields)
3. `await plugin.coreApi.createEntity({ projectRef: { id: projectEntry.projectId }, entityTypeId, fields: formValues })`
4. Success → `this.close()` + refresh sidebar project list (callback or event)
5. Failure (API throws) → catch error, show `<div class="pf-ecm-api-error">{error.message}</div>` at top of modal body, keep open

### Modal title
`"New {entity.name.toLowerCase()}"` with colored icon badge matching sidebar button

---

## Phase 6 — Project Creation Modal

**`src/ui/project-create-modal.ts`** — `class ProjectCreateModal extends Modal`

Constructor args: `(app, plugin, onCreated: () => void)`

### Type selector
- Horizontal scrollable row of cards (~148px fixed width), scroll-snap
- Source: `mergeProjectTypes(plugin.settings.projectTypes)` — built-ins first
- Selected card: colored border + tinted background + name in type color
- Click card → update `selectedTypeId`, re-render preview section only (not full modal)
- Right fade hint via CSS gradient overlay

### Form fields
- **Project name**: text input; `oninput` → if `idAutoDerive`, set ID slug; if `tagAutoDerive`, set tag slug
- **Project ID**: text input with `#` prefix element; `oninput` → sets `idAutoDerive = false`
- **Project tag**: text input with `#` prefix colored per selected type; `oninput` → sets `tagAutoDerive = false`
- Slug helper: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')`
- **Dimension**: `<select>` from `plugin.settings.dimensions` sorted by `order`; `onchange` → reset category dropdown
- **Category**: `<select>` from selected dimension's `categories`

### Live preview panel
Updates on type card selection and name/ID changes:

1. **Folder structure tree**: monospace block showing vault path using `projectsRoot + '/' + projectId + '/' + each folderStructure entry`
2. **Structural files**: chip per `projectType.initialNotes` entry (show `fileName`)
3. **Ephemeral templates** (entity types): row per `projectEntities` entry — icon badge + name + key `<code>` badge

### Submit
1. Validate: name non-empty, ID non-empty, ID unique (`!plugin.settings.projectIndex.byId[id]`), tag non-empty
2. `await plugin.coreApi.createProject({ name, id, tag, dimension, category, projectTypeId: selectedTypeId })`
3. Success → `this.close()`, call `onCreated()` to refresh sidebar
4. Failure → inline error, keep open

---

## CSS (`styles.css` additions)

Use Obsidian variables: `--background-primary`, `--background-secondary`, `--background-modifier-border`, `--text-normal`, `--text-muted`, `--text-faint`, `--interactive-accent`, `--radius-s`, `--radius-m`.

Classes to add (all `.pf-browser-*` prefix):
- `.pf-browser-view` — flex column, full height
- `.pf-browser-header` — title + icon buttons row
- `.pf-browser-dim-tabs` — flex wrap, gap 4px, padding, border-bottom
- `.pf-browser-dim-tab` / `.pf-browser-dim-tab.active` — pill buttons
- `.pf-browser-cat-row` — horizontal scroll, no scrollbar
- `.pf-browser-cat-chip` / `.active`
- `.pf-browser-type-filter` — horizontal scroll, scroll-snap
- `.pf-browser-type-seg` / `.active`
- `.pf-browser-search-row` — padding + input
- `.pf-browser-mode-indicator` — small muted label
- `.pf-browser-list` — overflow-y auto, flex 1
- `.pf-browser-section-label` — ALL CAPS, muted
- `.pf-browser-proj-row` / `.active` / `.pinned` — hover state, left border
- `.pf-browser-pin-icon` — hidden by default, shown on `.pf-browser-proj-row:hover`
- `.pf-browser-proj-badge` — type abbreviation badge
- `.pf-browser-e-dot` — 5px circle
- `.pf-browser-entity-expand` / `.on` — collapsible area
- `.pf-browser-create-btn` / `.btn-ico` — pill button with icon
- `.pf-browser-pagination` — flex, space-between, arrows + label
- `.pf-browser-footer` — border-top, "New project" button
- Entity create modal: `.pf-ecm-body` (2-col grid), `.pf-ecm-label`, `.pf-ecm-error`
- Project create modal: `.pf-pcm-type-scroller`, `.pf-pcm-type-card` / `.active`, `.pf-pcm-preview`, `.pf-pcm-tree` (monospace)

---

## Verification

1. `npm run build` — no TypeScript errors
2. `npm run deploy` — deploy to test vault
3. In Obsidian: sidebar panel appears on left automatically on plugin load
4. Dimension tabs switch correctly; category chips update per dimension
5. Search with `tag:`, `id:`, plain text all filter correctly
6. Pagination appears when > 10 projects; resets on filter change
7. Pin/unpin persists after Obsidian reload (check `data.json` for `pinnedProjects` array)
8. Stale pins silently removed (archive a pinned project, reload)
9. Project row click expands entity buttons; only one expanded at a time
10. Entity buttons match `projectEntities` for that project's type — no hardcoded types
11. Entity create modal opens with correct title and fields; submit calls `createEntity`; error shown on empty name
12. Project create modal: type card selection updates preview; name auto-slugs ID+tag; submit calls `createProject`; sidebar refreshes
13. Settings schema version in `data.json` = 14; `pinnedProjects: []` present
