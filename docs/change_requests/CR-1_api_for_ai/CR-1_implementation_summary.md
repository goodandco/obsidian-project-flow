# CR-1 Implementation Summary

## Overview
Phase 1–3 of CR-1 are implemented: core API exposure, project indexing, template-driven entity creation, patching utilities, project types, project relationship graph with archived support, and developer docs + API compatibility metadata.

## Key Capabilities Delivered
- Versioned core API exposed via `window.PluginApi["@projectflow/core"]` with fallback access and compatibility metadata.
- Persisted `projectIndex` for fast lookup by full name, id, or tag with eager migration.
- `entityTypes` registry with hierarchical template resolution (project -> vault -> builtin).
- `createEntity` with safe folder creation, filename rules, and required field checks.
- Markdown patching utilities with marker/heading/append behavior and strict/lenient modes.
- `projectTypes` registry with built-in defaults and user overrides; createProject uses selected type.
- `projectGraph` persisted with active + archived subtrees; `getChildren`/`getParents` API.
- Settings UI additions (templates root) and data migrations.
- Developer docs for third-party consumers.

## Data Model Updates
- Added `projectIndex`, `projectGraph`, `entityTypes`, `projectTypes`, and `templatesRoot` to `data.json`.
- Settings schema version bumped to 3 with migrations.

## API Surface
- Project resolution and listing: `resolveProject`, `listProjects`.
- Registries: `listProjectTypes`, `describeProjectType`, `listEntityTypes`, `describeEntityType`.
- Actions: `createProject`, `createEntity`.
- Patching: `patchMarker`, `patchSection`.
- Relationships: `getChildren`, `getParents`, `clearArchivedProjectGraph`.
- Compatibility metadata and input validation for API calls.

## Notable Behavior Changes
- Project creation now honors `projectTypeId` for folder structure and initial notes.
- Templates can be overridden at project and vault levels; built-ins remain fallback.
- Archived projects are included in relationship graph via a separate subtree.

## Tests Added
- projectIndex build/migration tests.
- markdown patcher tests.
- projectTypes merge/selection tests.
- projectGraph tests (active + archived).
