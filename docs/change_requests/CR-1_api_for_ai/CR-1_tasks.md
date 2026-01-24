# CR-1 Tasks

## Phase 1: Core API + Index + Entity Types
- T1: Audit current data model and identify source of projectRecords and path rules.
- T2: Define projectIndex schema version; implement build and persist on plugin load.
- T3: Add runtime cache for projectIndex; update resolveProject to use it.
- T4: Add entityTypes registry structure in data.json with defaults in code.
- T5: Implement template resolution (project -> vault -> builtin) with templateScope support.
- T6: Implement safe folder creation for createEntity with allowed roots.
- T7: Implement MarkdownPatcher with marker, heading, and append fallback; strict/lenient modes.
- T8: Expose API via window.PluginApi["@projectflow/core"]; add app.plugins fallback shim.
- T9: Add API capabilities/version discovery object.
- T10: Refactor to UI-free domain services and update call sites.
- T11: Write unit tests for index build, resolveProject, and migration behavior.
- T12: Write unit tests for template resolution, folder safety, and patching modes.
- T13: Add integration test for API exposure and fallback shim.
- T14: Update docs for API surface, entityTypes, and patching contract.

## Phase 2: Project Types (Blueprints)
- T15: Define projectTypes builtins in code and merge strategy with data.json overrides.
- T16: Update createProject to use projectTypes config.
- T17: Add tests for projectTypes merge and createProject behavior.

## Phase 3: Relationships and Hardening
- T18: Decide on projectGraph persistence vs runtime derivation; implement.
- T19: Add listChildren/listParents helpers to core API if needed.
- T20: Add schema migration and compatibility checks for future upgrades.

## Completion Criteria
- All Phase 1 tasks done with green tests.
- API surface is versioned and stable.
- projectIndex is persisted and used for lookups.
- entityTypes and patching work with safe defaults.

