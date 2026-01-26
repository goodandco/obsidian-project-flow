# Architecture

## Overview
ProjectFlow is an Obsidian desktop plugin that creates a structured project workspace in the user vault. It collects project metadata via modals, generates folders and notes from templates, and exposes a versioned core API for automation. It persists registries and indexes in plugin settings for fast lookup and relationship queries.

## Entry Points
- `main.ts` exports the plugin class.
- `src/plugin.ts` registers commands and the settings tab.

## Key Modules
- `src/commands/`
  - `add-project`: collects inputs and triggers project creation.
  - `remove-project`: prompts for a project id and deletes project content.
  - `archive-project`: prompts for a project id and moves content to archive.
- `src/utils/`
  - `project-prompts.ts`: orchestrates user prompts for new and existing projects.
  - `prompts.ts`: wrappers around modals.
- `src/services/`
  - `project-service.ts`: creates project folders/files, processes templates, and records metadata.
  - `project-management-service.ts`: deletes projects, archives projects, and deletes archived projects.
  - `entity-service.ts`: creates registry-driven entities with template resolution and safe folder rules.
  - `resolve-service.ts`: resolves projects by full name, id, or tag using the index.
  - `core-api.ts`: versioned API surface for plugin-to-plugin automation.
  - `file-manager.ts`: safe file operations with best-effort rollback.
- `src/core/`
  - `project-utils.ts`: derives variables for templating and wraps template processing.
  - `template-processor.ts`: replaces `${VAR}` and legacy `$_VAR` tokens.
  - `input-validator.ts`: validates project name and tag/id formats.
  - `path-sanitizer.ts`: ensures safe file and folder names.
  - `path-constraints.ts`: ensures paths stay within allowed roots.
  - `settings-schema.ts`: migrates settings to the current schema.
  - `project-index.ts`: builds and caches the flat project index.
  - `project-graph.ts`: builds and caches parent/child relationships (active + archived).
  - `registry-defaults.ts` / `registry-merge.ts`: built-in registry definitions and merge logic.
  - `markdown-patcher.ts`: marker/heading patching with strict/lenient modes.
  - `api-validators.ts` / `api-errors.ts`: API input validation and error normalization.

## Data Model
- Settings are stored in Obsidian plugin data (see `ProjectFlowSettings` in `src/interfaces.ts`).
- `dimensions` defines the user configured categories and order.
- `projectRecords` is a nested map: dimension -> category -> projectId -> ProjectRecord.
- `archivedRecords` stores the same shape for archived projects.
- `projectIndex` provides flat lookup maps by full name, id, and tag.
- `projectGraph` stores parent/child relationships for active and archived projects.
- `entityTypes` defines entity creation rules (templates, paths, filename rules).
- `projectTypes` defines project blueprints (folders, initial notes, allowed entities).

## Main Flows
### Add Project
1. `showAddProjectPrompt` gathers name, tag, id, optional parent, dimension, category.
2. `createProject` derives variables and sanitized paths.
3. Folders and main files are created from templates in `.obsidian/plugins/project-flow/src/templates/`.
4. Project-specific templates are created under `Templates/<ProjectName>_Templates`.
5. `projectRecords` is updated with the new `ProjectRecord`.
6. `projectIndex` and `projectGraph` are updated.

### Remove Project
1. `showRemoveProjectPrompt` collects dimension, category, and project id.
2. `deleteProjectById` deletes the project folder and template folder.
3. `projectRecords` is updated to remove the entry.
4. `projectIndex` and `projectGraph` are updated.

### Archive Project
1. `showArchiveProjectPrompt` collects dimension, category, and project id.
2. `archiveProjectByPromptInfo` moves the project folder under the archive root.
3. Template folder is moved alongside the archive folder when present.
4. Records are moved from `projectRecords` to `archivedRecords`.
5. `projectIndex` and `projectGraph` are updated (active -> archived).

### Create Entity
1. `createEntity` resolves the project via `resolve-service`.
2. Entity type rules are loaded from `entityTypes`.
3. Templates are resolved in order: project -> vault -> builtin.
4. Target folders are created within allowed roots and the note is written.

## Templates and Variables
- Templates live inside the plugin folder in the vault and are read via the vault adapter.
- Entity templates resolve in order: `Templates/<ProjectName>_Templates`, `Templates/ProjectFlow`, built-in templates.
- Variables are generated in `generateProjectVariables` and support both `${VAR}` and `$_VAR` formats.

## Core API
- API is exposed via `window.PluginApi["@projectflow/core"]` with a fallback `getApi()` accessor.
- Compatibility metadata is available on `api.compatibility`.

## Settings and UI
- `src/settings-tab.ts` renders the plugin settings, dimension/category management, and archive list.
- Settings include `projectsRoot`, `archiveRoot`, `templatesRoot`, and an ordered list of dimensions.

## Testing and Build
- Unit tests target pure helpers under `src/core/` with Vitest.
- Build uses esbuild with `main.ts` as the entry point.
