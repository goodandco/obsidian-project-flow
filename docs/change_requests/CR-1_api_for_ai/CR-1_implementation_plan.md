# CR-1 Implementation Plan

## Goal
Prepare ProjectFlow core for AI usage by adding a stable, versioned core API, fast project lookup, and registry-driven entity creation, with safe patching primitives. No AI UI or providers in this scope.

## Scope (Phase 1)
- Expose core API via window.PluginApi["@projectflow/core"] with plugin-registry fallback.
- Add projectIndex with eager migration on plugin load and persisted schema versioning.
- Add entityTypes registry with hierarchical template resolution and safe folder creation.
- Add patching utilities with marker and heading support plus lenient/strict modes.
- Refactor domain logic into UI-free services for API stability and testability.

## Non-Goals
- AI addon UI or automation flows.
- Backend or LLM provider integration.
- Subscription, licensing, or MCP server.

## Decisions Applied
- projectIndex: eager build on load; persist to data.json; keep runtime cache.
- PROJECT_FULL_NAME: YEAR.Parent.Project; no dimension/category.
- Template resolution priority: project, vault, builtin.
- projectTypes: builtins + user overrides (merge by id).
- createEntity: create missing folders only under allowed roots.
- Patching: standardized markers; lenient fallback to headings; append if missing.
- API: window.PluginApi primary, app.plugins fallback.

## Architecture Changes
- Introduce domain services:
  - ProjectFlowService (resolve, list, validate).
  - EntityFactory (template resolution, folder creation).
  - TemplateRenderer (hydrate templates; isolated from UI).
  - MarkdownPatcher (marker/heading/append with patchMode).
- Centralize data access and migration logic.

## Data Model Changes (data.json)
- projectIndex: { byFullName, byId, byTag, version }.
- entityTypes: registry with templatePath, targetFolder, filenameRule, schema, tags, patchMarkers, templateScope.
- projectTypes: builtins in code merged with user overrides in data.json.

## Core API Surface (v1)
- resolveProject(ref)
- listProjects(filter?)
- listProjectTypes(), describeProjectType(id)
- listEntityTypes(projectRef?), describeEntityType(entityTypeId)
- createProject(req)
- createEntity(req) -> { path }
- patchMarker(req) / patchSection(req)

## Migration Strategy
- On plugin load:
  - If projectIndex missing or version mismatch: build from projectRecords, persist.
  - Build runtime cache from persisted index.
- Backward compatible: if fields missing, defaults loaded from builtins.

## Safety and Validation
- Enforce writes under projectsRoot and archiveRoot.
- Reject path traversal and unsafe paths.
- No UI side effects in API methods; return structured errors.

## Testing Plan
- Unit tests for:
  - projectIndex build/migration and resolveProject.
  - template resolution priority and overrides.
  - folder creation rules and path safety.
  - patching with markers, headings, and fallback behavior.
- Integration tests for API exposure and fallback shim.

## Deliverables
- New/updated domain services and API surface.
- Data model updates and migration.
- Documentation updates for API and registries.

