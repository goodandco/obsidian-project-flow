# Change Request: ProjectFlow AI Module (Chat-First, Tool-Only Agent)

## Summary

This Change Request introduces an **AI Module inside the existing ProjectFlow plugin**.

The AI Module provides a chat-based user interface (right panel in Obsidian) and integrates directly with LLM providers (initially OpenAI, later Anthropic and OpenAI-compatible local models such as Ollama).  
The AI agent operates in **tool-only mode**: it cannot access the vault or filesystem directly and can only perform actions through ProjectFlow Core APIs and registered tools (including future MCP servers).

ProjectFlow Core remains the single authority for:
- project resolution
- entity creation
- template rendering
- markdown patching
- filesystem writes

The AI Module acts as an orchestration layer between the user, LLM, and ProjectFlow Core.

This CR builds on the previously completed “AI-ready Core” changes (projectIndex, entityTypes, projectTypes, projectGraph, core API, template resolution, patching contract).

---

## WHAT

### 1. Add AI Module to ProjectFlow Plugin

Introduce a new internal module in ProjectFlow that provides:

- Chat-first UI embedded in Obsidian (right sidebar panel)
- Message history and input box
- Context collection:
  - selected text
  - active note
  - project index snapshot
- Agent loop:
  - send user message + context to LLM
  - receive structured tool calls
  - execute them via ProjectFlow Core

No separate daemon or secondary plugin is introduced at this stage.

---

### 2. LLM Provider Integration

Add configurable LLM support in ProjectFlow settings:

Initial:
- OpenAI API

Planned:
- Anthropic
- OpenAI-compatible endpoints (e.g. Ollama)

Settings include:
- provider
- API key
- base URL (for local / compatible providers)
- model

The implementation uses a unified client interface so providers can be swapped without changing agent logic.

---

### 3. Tool-Only Agent Execution Model

The AI agent:

- cannot write markdown
- cannot access the filesystem
- cannot resolve paths
- cannot modify templates

Instead, it may only invoke registered tools.

Primary tools exposed to the agent:

- resolveProject
- listEntityTypes
- createProject
- createEntity
- patchMarker / patchSection
- relationship helpers

The LLM returns structured actions (AgentPlan), for example:

- createEntity
- patchMarker

ProjectFlow executes these actions via Core APIs.

This establishes the invariant:

LLM → Tool Calls → ProjectFlow Core → Vault

---

### 4. AgentPlan Abstraction

Introduce a structured execution format (“AgentPlan”) inside the AI Module:

- LLM output is parsed into a list of tool invocations
- Each action specifies:
  - tool name
  - arguments
- A dedicated executor applies these actions sequentially using ProjectFlow Core

The LLM never produces raw markdown for direct writing.

---

### 5. MCP Integration (Future Extension)

Prepare the AI Module to support MCP servers as additional tool providers, for example:

- Google Calendar
- external task systems
- other integrations

MCP tools are registered alongside ProjectFlow Core tools and exposed uniformly to the agent.

This CR includes architectural support for MCP but does not require implementing specific MCP servers.

---

### 6. AI Markers and Template Contract

Built-in templates shipped with ProjectFlow define automation-safe zones using standardized AI markers (HTML comments such as `<!-- AI:NOTES -->`, `<!-- AI:ACTIONS -->`).

User and project-level templates:
- may override or remove markers freely
- are not required to follow a standardized layout

Core patching behavior:

1. Prefer AI markers if present
2. Fall back to heading-based patching
3. Fall back to appending content (lenient mode)
4. Fail explicitly in strict mode

Markers are part of the stable core contract but are not mandatory for user customization.

---

## WHY

### 1. Enable Natural Language Project Management

Users can interact with ProjectFlow via chat:

- “add this to problog”
- “create a task for next sprint”
- “summarize this meeting and add action items”

This removes friction for non-technical users (e.g. project managers) while preserving the structured project model.

---

### 2. Preserve Determinism and Safety

By enforcing a tool-only agent:

- AI never edits files directly
- all writes go through ProjectFlow Core
- filesystem boundaries and invariants are preserved
- template logic remains deterministic

This prevents accidental corruption of the vault and supports enterprise-grade governance.

---

### 3. Leverage Existing Core Platform

ProjectFlow Core already provides:

- projectIndex and relationship graph
- entityTypes and projectTypes
- template resolution
- markdown patching
- safety checks

Embedding AI directly into ProjectFlow allows immediate reuse of this platform without introducing additional processes or plugins.

---

### 4. Faster MVP with Future Extensibility

Placing AI inside ProjectFlow:

- minimizes deployment complexity
- accelerates delivery of real user value
- avoids premature platform fragmentation

At the same time, the AgentPlan + tool abstraction preserves the option to move intelligence to an external service in the future if needed (enterprise, monetization, governance).

---

### 5. Prepare for Ecosystem Integrations

By treating ProjectFlow as an agent host and tool orchestrator, MCP integrations can be added naturally, enabling:

- calendar synchronization
- external systems
- collaborative workflows

without changing the core architecture.

---

## HOW

### 1. AI Module Structure (inside ProjectFlow)

Add an internal AI module with:

- Chat View (right sidebar)
- LLM Client (provider abstraction)
- Tool Registry (ProjectFlow Core + MCP)
- Agent Executor

Suggested layers:

- AI UI (chat panel)
- Agent Loop (prompt → tools → execution)
- AgentPlan Executor
- ProjectFlow Core (unchanged domain layer)

---

### 2. Chat Flow

1. User enters message in chat panel
2. ProjectFlow AI Module gathers context
3. Prompt + context + available tools are sent to LLM
4. LLM returns structured tool calls
5. AgentPlan Executor invokes ProjectFlow Core APIs
6. Core performs filesystem operations
7. Results are shown back in chat

---

### 3. Tool Registration

Expose ProjectFlow Core methods as tools with:

- name
- input schema
- description

Optionally register MCP tools using the same interface.

The agent only sees this unified tool registry.

---

### 4. Execution Guarantees

- All tool calls are validated before execution
- Core enforces:
  - allowed roots
  - entityType/projectType validity
  - template resolution rules
- No direct write access is granted to the AI layer

---

### 5. Incremental Delivery

Phase 1:
- Chat UI
- OpenAI integration
- Core tools
- Basic AgentPlan execution
- Simple flows (e.g. “add this to project”)

Phase 2:
- Anthropic / Ollama support
- Improved context handling
- Multi-step agent loops

Phase 3:
- MCP integrations
- Advanced workflows
- Collaboration-oriented features

---

## Acceptance Criteria

- Users can interact with ProjectFlow via chat
- AI can create projects and entities only through Core tools
- LLM has no direct filesystem or markdown access
- Templates and AI markers work with graceful degradation
- OpenAI provider is configurable via settings
- Architecture supports adding MCP servers without refactoring Core

---
