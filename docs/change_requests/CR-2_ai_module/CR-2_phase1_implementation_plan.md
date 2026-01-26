# CR-2 Phase 1 Implementation Plan

## Goal
Deliver a chat-first AI module inside ProjectFlow with OpenAI integration, a tool-only AgentPlan executor, and simple end-to-end flows that write via Core tools only.

## Scope (Phase 1)
- Chat UI in right sidebar with enable/disable toggle.
- OpenAI provider integration with configurable settings.
- Tool registry with JSON schema per tool.
- AgentPlan parsing and sequential execution.
- Simple flows (e.g. create entity/task from selection).

## Non-Goals
- Anthropic/Ollama support.
- Multi-step tool loops.
- MCP integrations.
- Collaboration features.

## Decisions Applied
- Stage 1.1 input is **project tag only** (no fuzzy matching).
- Stage 1.2 prompt prepends: `I'm going to create a project with tag ${input}`.
- Tool registry requires JSON schema per tool.
- Tool execution is immediate (no confirmation). Chat must surface tool usage.
- Streaming for tool usage and LLM partial output is required in Phase 1.

## Architecture Changes
- AI module package:
  - ChatView (UI + message history).
  - LLMClient (OpenAI).
  - ToolRegistry (Core tools + schemas).
  - AgentPlanParser + AgentPlanExecutor.
- Data flow:
  - user message + context -> LLM -> structured plan -> Core tool calls -> results -> chat.

## UI + UX
- Right sidebar chat view, active only when `enableAI` is true.
- Message history with assistant responses.
- Tool usage displayed in chat (non-blocking status messages).
- Streaming display of LLM output and tool usage updates.

## Core Tooling
- Expose tools with:
  - name
  - description
  - input schema (JSON Schema)
- Phase 1 tools:
  - resolveProject
  - listEntityTypes
  - createProject
  - createEntity
  - patchMarker / patchSection
  - relationship helpers

## LLM Integration
- OpenAI client with settings:
  - API key
  - model
  - base URL
- Prompt includes:
  - user message
  - selection
  - active note
  - projectIndex snapshot
  - prepend tag message line (per decision)
- Response expected as structured tool calls (AgentPlan format).

## Data Model / Settings
- Add AI settings block to plugin data:
  - enableAI
  - provider (OpenAI only)
  - apiKey
  - model
  - baseUrl

## Safety + Validation
- All tool calls validated against JSON schema.
- Core remains sole writer; AI module has no file access.

## Testing Plan
- Unit tests:
  - Tool schema validation.
  - AgentPlan parsing and sequencing.
- Integration tests:
  - Chat -> OpenAI -> tool call -> Core execution -> chat result.

## Deliverables
- AI module scaffold + ChatView.
- OpenAI provider + settings UI.
- Tool registry with schemas.
- AgentPlan executor wired to Core tools.
- Simple flow demo (create entity from selection).

## Open Questions
- None.
