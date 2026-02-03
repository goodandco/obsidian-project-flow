# ProjectFlow

ProjectFlow is a local-first project management and automation plugin for Obsidian.

It helps you create structured project workspaces, manage tasks and meetings via templates, and (optionally) use AI to automate common workflows — all while keeping your vault as the single source of truth.

ProjectFlow is designed as a deterministic domain engine on top of Markdown:
projects, entities, templates, and relationships are managed through explicit APIs and contracts, not free-form AI edits.

---

## Key Ideas

- **Local-first**: Your vault is always the system of record.
- **Deterministic Core**: Projects and entities are created through explicit APIs and templates.
- **Tool-only AI**: The AI agent never edits files directly. All changes go through ProjectFlow Core.
- **User-customizable templates**: You fully control layouts and structures.
- **Extensible**: Designed to support external tools (via MCP) and multiple LLM providers.

---

## Features

### Core Project Management

- Guided project creation (name, tag, ID, parent, dimension, category)
- Configurable dimensions and categories
- Automatic folder structure and note generation
- Project registry with:
  - projectIndex
  - projectGraph (parent/child relationships)
  - projectTypes
  - entityTypes
- Deterministic entity creation (tasks, meetings, sprints, ideas, etc.)
- Project-specific template folders
- Safe markdown patching with markers / headings / append fallback
- Archiving with subtree support

### Template System

Templates are resolved in three layers (highest priority first):

1. Per-project templates  
   `Templates/<PROJECT_NAME>_Templates/`

2. Vault-level templates (configurable root, default: `Templates/ProjectFlow/`)

3. Built-in plugin templates (fallback)

`entityTypes` define:
- which template to use
- target folder
- filename rules

Built-in templates act as reference implementations.  
Vault and project templates may freely override or replace them.

---

## Configuration (Required)

Before creating projects, you must configure ProjectFlow.

Open:

Settings → Community Plugins → ProjectFlow

ProjectFlow uses **Dimensions** and **Categories** to organize projects.  
These define your folder structure and must be set up first.

### Dimensions

Dimensions represent high-level areas of your life or work, for example:

- Business
- Personal
- Family
- Health

Each dimension has:

- a name
- an order (used to prefix folders, e.g. `1. Business`)
- a list of categories

You can:

- add, rename, and delete dimensions
- reorder dimensions (affects folder names)
- reset to defaults

---

### Categories

Each dimension contains one or more categories, for example:

Business:
- R&D
- Jobs
- OpenSource

Personal:
- Writing
- Reading
- Sports

Categories define the second level of the project path.

---

### Projects Root

All projects are created under the configured root folder
(default: `1. Projects`).

This can be changed in settings.

---

### Templates Root

Vault-level templates are resolved from the configured templates root
(default: `Templates/ProjectFlow/`).

Project-specific templates are always created under:

`Templates/<PROJECT_NAME>_Templates/`

These override vault and built-in templates.

---

### AI Settings (Optional)

If you enable the AI module, additional settings appear:

- Enable AI (on/off)
- Provider (OpenAI / Anthropic / compatible local endpoint)
- API key
- Model
- Base URL (for OpenAI-compatible providers such as Ollama)

When AI is disabled:

- the chat panel is hidden
- no LLM clients are initialized
- ProjectFlow behaves as a pure project management plugin

---

### Important

Dimensions and categories must be configured before creating projects.

They determine:

- folder structure
- project paths
- how entities are organized

ProjectFlow does not assume defaults beyond the initial setup.

---

## AI Module (Optional)

ProjectFlow includes an optional AI module with a chat-first interface.

When enabled, a right-panel chat allows you to use natural language to:

- resolve projects
- create entities (tasks, meetings, notes, etc.)
- patch notes
- run simple workflows

### Supported Providers

- OpenAI (initial)
- Anthropic (planned)
- OpenAI-compatible local endpoints (e.g. Ollama)

Provider, model, API key, and base URL are configurable in settings.

---

## AI & Automation Model

ProjectFlow uses a **tool-only agent architecture**.

The AI agent:

- cannot access the filesystem directly
- cannot write markdown files
- cannot modify templates
- does not know vault paths

Instead, the agent may only call registered tools such as:

- resolveProject
- createProject
- createEntity
- patchMarker / patchSection
- relationship helpers

All filesystem operations are performed exclusively by ProjectFlow Core.

In other words:

```
LLM → Tool Calls → ProjectFlow Core → Vault
```

This ensures:

- deterministic behavior
- vault safety
- clear audit boundaries
- future enterprise compatibility

---

## AI Markers (Template Automation Contract)

Built-in templates define automation-safe zones using HTML comments such as:

```md
<!-- AI:CONTENT -->
<!-- AI:NOTES -->
<!-- AI:ACTIONS -->
<!-- AI:AGENDA -->
<!-- AI:SUMMARY -->
```

These markers indicate where automation is allowed to write.

User and project templates:

- are NOT required to include markers
- may rename or remove them freely

Core patching behavior:

1. Prefer AI markers if present
2. Fall back to heading-based patching
3. Fall back to appending content (lenient mode)
4. Fail explicitly in strict mode

Markers are part of the core automation contract, but never mandatory for customization.

---

## Getting Started

### Installation

(Currently via development build / manual install.)

1. Clone or download the repository.
2. Place it into your vault:

```
.obsidian/plugins/projectflow/
```

3. Enable ProjectFlow in Obsidian Community Plugins.
4. Open ProjectFlow settings to configure:
   - Dimensions & categories
   - Templates root
   - (Optional) AI provider settings

---

### Creating a Project

Run from the Command Palette:

- **ProjectFlow: Add Project Info**

You’ll be prompted for:

1. Project name
2. Project tag
3. Project ID
4. Optional parent
5. Dimension
6. Category

ProjectFlow will:

- create the folder structure
- generate initial notes
- copy project templates
- register the project in its internal index

---

### Using AI (if enabled)

Enable AI in ProjectFlow settings.

Open the ProjectFlow AI panel and type, for example:

- add this to problog
- create a task from this note
- summarize this meeting and add action items

The agent will translate your request into structured tool calls executed by ProjectFlow Core.

---

## Roadmap (High Level)

Phase 1:
- Chat UI
- OpenAI integration
- Core tools
- Basic AgentPlan execution
- Simple flows

Phase 2:
- Anthropic / Ollama support
- Improved context handling
- Multi-step agent loops

Phase 3:
- MCP integrations
- Advanced workflows
- Collaboration-oriented features

---

## License

ProjectFlow is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

This means:

- You are free to use, modify, and self-host ProjectFlow.
- If you deploy ProjectFlow (or a modified version) as a network service,
  you must make the source code of your modifications available.

Commercial licenses will be available for organizations that require
non-AGPL usage (e.g. closed-source deployments, enterprise support).

See LICENSE for details.

---

## Contributing

Contributions are welcome.

By submitting a pull request or other contribution, you agree that your
contributions will be licensed under AGPL-3.0.

Please keep changes focused and document new features.

See CONTRIBUTING.md for details.

---

## Security

If you discover a security issue, please report it privately.

Do not open public issues for vulnerabilities.

(Contact information will be provided.)

---

## Trademark

“ProjectFlow” is a trademark of Oleksandr Hudenko.

You may use the name to refer to the open-source project,
but not to market derived products or services without permission.

---

## Philosophy

ProjectFlow treats Markdown as a real project system, not just notes.

AI is a helper — not an editor of record.

The goal is to combine:

- human control
- deterministic structure
- automation
- extensibility

without giving up ownership of your data.

---
