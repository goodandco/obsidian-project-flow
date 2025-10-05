# ProjectFlow Plugin — Final Design (Reconciled)

Date: 2025-09-29 18:34
Version: 2.0 – Finalized Design (Actionable, Phased)

Overview
This document reconciles the current-state analysis (ANALYSIS.md) with the refactored architecture proposal (design.md) into a single, actionable design. It prioritizes minimal, non‑breaking steps that align with the repository’s build/runtime constraints (Obsidian plugin with esbuild bundling) while defining a clear path toward the proposed clean architecture.

Scope & Goals
- Preserve working build and Obsidian runtime compatibility.
- Incrementally improve maintainability, safety, and testability.
- Establish a layered architecture with clear boundaries as a longer-term goal.

1. Current State Summary (from ANALYSIS.md)
- Build & Tooling: TypeScript 4.7.4, esbuild 0.17.x, Node 16+; externals for obsidian/electron/CodeMirror; output main.js at repo root. Banner expected in bundles.
- Commands: npm run dev → watch; npm run build → type-check + production bundle.
- Plugin Layout: manifest.json, main.js, styles.css in root; templates read from vault path .obsidian/plugins/<id>/src/templates/*.md at runtime.
- Architecture: AutomatorPlugin orchestrates input and project creation; settings tab for dimensions/categories; template substitution uses $_VARIABLE tokens.
- Observations/Risks: naming typos (choise-modal), create() throws if file exists, hardcoded projects root ("1. Projects"), PARENT_TAG semantics, no unit tests.

2. Target Architecture (from design.md, adapted)
Core Principles
- Separation of concerns: UI vs. core logic vs. services.
- Input validation, safe file operations, error resilience.
- Testability of pure logic without Obsidian runtime.

Layered Structure (destination)
- core/
  - variable-generator.ts: Generate project variables from user input and context.
  - template-processor.ts: Substitute variables in template content.
  - project-creator.ts: Orchestrate project structure and file creation.
- services/
  - file-manager.ts (SafeFileManager): Existence checks, atomic batches, rollback.
- ui/
  - modals/* and settings/*: UI components and settings tab.

Improved Mechanics
- Validation: InputValidator.validateProjectName, etc.
- Template Engine: Switch from $_VARIABLE to ${VARIABLE} pattern internally, with backward compatibility to support both forms during transition.
- Settings Management: Settings schema with version and migration hooks.
- Security: PathSanitizer for names/paths.

3. Gap Analysis and Design Decisions
3.1 Variable/Template Syntax
- Current: $_VARIABLE tokens.
- Proposed: ${VARIABLE} regex engine.
- Decision: Support both syntaxes during migration to avoid breaking existing templates. Prefer ${...} in new templates and docs.

3.2 File Creation Semantics
- Current: vault.create throws if file exists.
- Decision: Introduce SafeFileManager with existence checks and failure rollback for multi-file ops. Initial minimal step: check existence and skip with log; future: atomic batch and rollback.

3.3 Projects Root Directory
- Current: Hardcoded "1. Projects".
- Decision: Add setting projectsRoot (default "1. Projects"). Non-breaking; UI control optional in a later iteration.

3.4 Naming Typos and Backward Compatibility
- choise-modal.ts vs choice-modal.ts, "Discusion"/"idea" casing in templates.
- Decision: Defer renames to a cleanup phase; provide aliases or fallback handling where feasible.

3.5 Test Strategy
- Constraints: Obsidian externals not available in Node.
- Decision: Maintain minimal build verification test in scripts; extract pure helpers to enable unit tests later (Vitest optional).

4. Phased Implementation Plan
Phase 0 — Baseline Verification (now)
- Ensure npm run build succeeds and banner exists in main.js. Keep Obsidian externals untouched. (Already verified in analysis.)

Phase 1 — Minimal, Non-Breaking Improvements
1. Extract pure helpers into src/lib (or src/core) without renaming existing files:
   - variable generation (generateProjectVariables)
   - template processing that supports both $_VAR and ${VAR}
   - Expose functions used by plugin.ts
2. Introduce SafeFileManager (minimal):
   - has(path), ensureFolder(path), createIfAbsent(path, data).
   - On conflict: skip and log; do not throw.
3. Add projectsRoot setting (default "1. Projects"). Use in path construction.
4. Document template directory expectations and dual-syntax support in README.

Phase 2 — Enhanced Safety and Structure
1. Expand SafeFileManager to support batched create with partial rollback on failure.
2. Add InputValidator and PathSanitizer for names/paths.
3. Begin moving logic toward src/core and src/services folders; update imports.
4. Settings schema versioning and minimal migration utility.

Phase 3 — Developer Experience & Testing
1. Add scripts/build.test.mjs for CI-safe build verification (banner + size check).
2. Optional: Add Vitest with unit tests for pure helpers (no obsidian import).
3. Linting scripts (eslint) if desired.

Phase 4 — Cleanup and Renames
1. Consider renaming choise-modal.ts → choice-modal.ts with export alias to avoid breaks.
2. Normalize template names/labels; update docs. Provide backward-compat name mapping if referenced.

5. High-Level APIs (interfaces and behaviors)
TemplateEngine
- Input: template content string; variables Record<string,string>.
- Behavior: Replace ${VAR} or $_VAR; undefined variables throw by default; allow option to leave placeholders unchanged in future.

SafeFileManager (initial)
- has(path): Promise<boolean>
- ensureFolder(path): Promise<void>
- createIfAbsent(path, data): Promise<'created'|'skipped'>
- Future: batch(ops).run() with rollback.

InputValidator
- validateProjectName(name): not empty, <= 50 chars, safe chars.
- validateTag(tag): similar constraints.

PathSanitizer
- sanitizeFileName(name)
- sanitizePath(path)

Settings
- projectsRoot: string (default "1. Projects").
- schema.version: string; migrations optional in Phase 2.

6. Risks and Mitigations
- Breaking template token change → Mitigation: dual-syntax support.
- Partial file creation on errors → Mitigation: initial skip-on-exist and later rollback.
- User data overwrite → Mitigation: never overwrite by default; future confirmation flow.
- Refactor churn → Mitigation: phased approach; maintain stable AutomatorPlugin API surface.

7. Testing & Validation
- Build Verification (immediate):
  - npm run build must succeed and produce main.js with the esbuild banner "THIS IS A GENERATED/BUNDLED FILE BY ESBUILD".
- Minimal Script (optional but recommended): scripts/build.test.mjs performing build, size, and banner checks (see guidelines).
- Unit Tests (future):
  - Test generateProjectVariables and TemplateEngine using Vitest without obsidian import.

8. Documentation Updates
- README: clarify template locations in an Obsidian vault, dual token syntax, and new projectsRoot setting.
- Add short Troubleshooting note: missing template files cause "Template file not found"; ensure directories exist.

9. Acceptance Criteria
- The plugin continues to build and run in Obsidian unchanged (no user-visible breaking changes).
- final_design.md committed at repo root, reflecting reconciled plan and phased roadmap.
- Phase 1 items are implementable without changing runtime expectations or external file names.

10. Change Log (Design)
- New: Dual template token support policy.
- New: projectsRoot setting (planned).
- New: SafeFileManager minimal semantics (planned).
- Deferred: Atomic batch + rollback, settings migrations, file/typo renames.

Notes
- Do not edit generated main.js by hand. Always rebuild.
- Keep manifest.json version aligned with package.json for clarity.
