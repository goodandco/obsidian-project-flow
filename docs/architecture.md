# Architecture

## Overview
ProjectFlow is an Obsidian desktop plugin that creates a structured project workspace in the user vault. It collects project metadata via modals, generates folders and notes from templates, and stores a lightweight index of projects in plugin settings for later delete/archive actions.

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
  - `file-manager.ts`: safe file operations with best-effort rollback.
- `src/core/`
  - `project-utils.ts`: derives variables for templating and wraps template processing.
  - `template-processor.ts`: replaces `${VAR}` and legacy `$_VAR` tokens.
  - `input-validator.ts`: validates project name and tag/id formats.
  - `path-sanitizer.ts`: ensures safe file and folder names.
  - `settings-schema.ts`: migrates settings to the current schema.

## Data Model
- Settings are stored in Obsidian plugin data (see `ProjectFlowSettings` in `src/interfaces.ts`).
- `dimensions` defines the user configured categories and order.
- `projectRecords` is a nested map: dimension -> category -> projectId -> ProjectRecord.
- `archivedRecords` stores the same shape for archived projects.

## Main Flows
### Add Project
1. `showAddProjectPrompt` gathers name, tag, id, optional parent, dimension, category.
2. `createProject` derives variables and sanitized paths.
3. Folders and main files are created from templates in `.obsidian/plugins/project-flow/src/templates/`.
4. Project-specific templates are created under `Templates/<ProjectName>_Templates`.
5. `projectRecords` is updated with the new `ProjectRecord`.

### Remove Project
1. `showRemoveProjectPrompt` collects dimension, category, and project id.
2. `deleteProjectById` deletes the project folder and template folder.
3. `projectRecords` is updated to remove the entry.

### Archive Project
1. `showArchiveProjectPrompt` collects dimension, category, and project id.
2. `archiveProjectByPromptInfo` moves the project folder under the archive root.
3. Template folder is moved alongside the archive folder when present.
4. Records are moved from `projectRecords` to `archivedRecords`.

## Templates and Variables
- Templates live inside the plugin folder in the vault and are read via the vault adapter.
- Variables are generated in `generateProjectVariables` and support both `${VAR}` and `$_VAR` formats.

## Settings and UI
- `src/settings-tab.ts` renders the plugin settings, dimension/category management, and archive list.
- Settings include `projectsRoot`, `archiveRoot`, and an ordered list of dimensions.

## Testing and Build
- Unit tests target pure helpers under `src/core/` with Vitest.
- Build uses esbuild with `main.ts` as the entry point.
