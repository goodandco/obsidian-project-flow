# Change Request: ProjectFlow Platform API + AI Assistant Enablement

## Summary
This Change Request (CR) proposes evolving **ProjectFlow (Obsidian plugin)** into an **AI-ready platform core** by introducing a stable, versioned **ProjectFlow Core API**, fast **project indexing**, and configuration-based registries for **project types** and **template-driven entities**.

This CR is **only about preparing the core plugin for AI usage**.  
The **AI plugin implementation and automation workflows are explicitly out of scope** and will be delivered in subsequent CRs.

---

## 1) WHAT (Scope of Change)

### 1.1 Expose ProjectFlow Core Platform API (Plugin-to-Plugin)
Expose a stable, versioned ProjectFlow API using a global plugin registry (e.g. `window.PluginApi["@projectflow/core"]`), so other plugins (especially AI addon) can interact with ProjectFlow without duplicating domain logic.

**Key requirements**
- Domain API only (no UI modals, no notices as API behavior)
- Versioned API surface
- Capability discovery (`capabilities` object)
- Input validation and safe path constraints
- Handles plugin load order (consumer may load first)

---

### 1.2 Add Fast Project Lookup via Flat Index (`projectIndex`)
Add a flat index in `data.json` to resolve projects by:
- canonical project identity: `PROJECT_FULL_NAME` (e.g. `2025.GoodAndCo.ProBlog`)
- shorthand ID: `PROJECT_ID` (e.g. `PR-BLG`)
- project tag: `PROJECT_TAG` (e.g. `project/pro-blog`)

This avoids deep scans of `projectRecords[dimension][category][...]` and supports scalable automation and future team usage.

---

### 1.3 Introduce Template-Driven Entity Registry (`entityTypes`)
Add `entityTypes` registry in `data.json` describing how to create entities such as:
- task
- meeting.* (refinement/planning/retro/demo)
- sprint
- idea
- custom entities (user-defined)

Each entity type defines:
- template path (global or project-scoped)
- target folder rule (relative to project root)
- filename rule
- required field schema
- default tags
- AI patch points (markers or headings)

This makes ProjectFlow a generalized **entity factory** rather than hardcoded task/meeting logic.

---

### 1.4 Add Multiple Project Types (“Blueprints”) via `projectTypes`
Add `projectTypes` registry to support various project structures (beyond the current “operational” layout):
- operational (current)
- portfolio/program (parent/aggregator)
- course
- meetup
- additional future types

Each project type defines:
- folder structure
- initial notes created from templates (naming rules)
- allowed entity types for the project

During project creation, users choose a project type, stored in the project record.

---

### 1.5 Formalize Project Relationships (Parent / Portfolio)
ProjectFlow currently supports a `parent` field and hierarchical naming (e.g. `2025.Mobiquity.KLM-API`).  
This CR adds normalized relationship support to enable:
- parent resolution (canonical fullName)
- children listing (portfolio dashboards)
- reliable automation routing in hierarchies

This may be implemented as:
- persisted relationship index (`projectGraph`) OR
- derived runtime graph from canonical naming rules.

---

### 1.6 Establish Non-Destructive Editing Contract for Automation
To allow deterministic AI patching (without breaking user templates), introduce the recommended “contract”:
- section headings and/or HTML markers such as:
  - `<!-- AI:CONTENT -->`
  - `<!-- AI:ACTIONS -->`
  - `<!-- AI:AGENDA -->`

Provide patch tooling to modify only the intended parts of the note.

---

### Out of Scope
This CR **does not implement**:
- AI plugin UI (chat panel, flows)
- LLM providers integration (OpenAI/Ollama/etc.)
- MCP server or backend orchestration service
- subscription / billing / licensing

Those items will be addressed in follow-up CRs.

---

## 2) WHY (Business & Technical Justification)

### 2.1 AI Safety and Determinism
AI should not:
- invent folder paths
- write arbitrary YAML frontmatter
- decide tagging conventions
- move files ad-hoc

Instead, AI must invoke restricted tools while ProjectFlow enforces:
- canonical paths
- template rendering rules
- metadata/tag correctness
- invariants and validations

---

### 2.2 Preserve User Customization (Templates / Custom Entities)
ProjectFlow’s value is its template-based approach:
- users can fully modify templates
- users can add new templates for custom entities

A registry-driven approach enables this without code changes.

---

### 2.3 Separation of Concerns: Core vs AI Addon
A clean separation provides:
- stable core domain rules in ProjectFlow
- flexible experimentation in AI layer
- reduced dependencies in core plugin
- lower maintenance cost

---

### 2.4 Scalability and Performance
As the number of projects grows:
- deep nested searching becomes slow and complex
- automation and multi-step flows become brittle

A flat index significantly improves reliability.

---

### 2.5 Enterprise Readiness
By moving intelligence and policy into an external layer (AI addon/backend) while keeping file operations local and deterministic, ProjectFlow becomes suitable for:
- strict security environments
- private cloud / on-prem AI deployments
- audit and governance

---

## 3) HOW (Implementation Plan)

### 3.1 Data Model Enhancements (`data.json`)
Add the following top-level structures:

#### A) `projectIndex`
Maps multiple lookup keys to canonical project identity and paths:
- `byFullName`
- `byId`
- `byTag`

#### B) `entityTypes`
Registry for template-driven entity creation:
- templatePath
- targetFolder
- filenameRule
- schema (required fields)
- tags
- patch markers

#### C) `projectTypes`
Blueprint configuration:
- folder structure
- initial notes
- allowed entityTypes

#### D) Relationship Support
Add either:
- `projectGraph` (parents/children) persisted, OR
- runtime graph derived from canonical naming.

---

### 3.2 Canonical Identity Rules
- Canonical project identity: `PROJECT_FULL_NAME`
- `PROJECT_ID` remains shorthand and task prefix input
- Canonical filesystem location is derived and/or stored via:
  - `PROJECT_PATH`
  - projectsRoot + dimension order + category + PROJECT_FULL_NAME

---

### 3.3 Domain Layer Refactor
Introduce a domain service layer (UI-free), e.g.:
- `ProjectFlowService`
- `EntityFactory`
- `TemplateRenderer`
- `MarkdownPatcher`

This enables a stable API surface and testability.

---

### 3.4 Public Core API Surface
Expose as `@projectflow/core`:

**Suggested API**
- `resolveProject(ref)`
- `listProjects(filter?)`
- `listProjectTypes()` / `describeProjectType(id)`
- `listEntityTypes(projectRef?)` / `describeEntityType(entityType)`
- `createProject(req)`
- `createEntity(req)` → returns `{ path }`
- `patchMarker(req)` / `patchSection(req)`
- `patchFrontmatter(req)` (optional)

**Safety Controls**
- validate writes only under allowed roots (`projectsRoot`, `archiveRoot`)
- forbid destructive operations through API or require explicit confirmation
- return structured errors (no UI side effects in API calls)

---

### 3.5 Templater Compatibility Strategy
Maintain user-level flexibility by keeping templates editable:
- templates remain in vault
- entity types reference templates by path
- ProjectFlow ensures deterministic placement and stable results

ProjectFlow should not depend solely on template-side `tp.file.move()` for correctness.

---

### 3.6 Phased Delivery

#### Phase 1 (MVP: AI-Ready Core)
- add `projectIndex`
- add basic `entityTypes`
- expose core API: `resolveProject`, `createEntity`, `patchMarker`

#### Phase 2 (Blueprints & Scale)
- add `projectTypes`
- portfolio/program enhancements
- relationship graph/dashboards

#### Phase 3 (Ecosystem Enablement)
- API hardening
- compatibility checks and migrations
- developer docs for third-party consumers

---

## Acceptance Criteria
- Project can be resolved by full name, id, or tag
- Entity can be created deterministically using templates and settings registries
- Notes can be patched safely using markers/sections
- Multiple project types supported via configuration (blueprints)
- Core API is stable, versioned, and safe
- No AI implementation included in this CR

---
