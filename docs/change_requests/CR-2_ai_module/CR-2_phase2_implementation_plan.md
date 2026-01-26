# CR-2 Phase 2 Implementation Plan

## Goal
Expand AI module capabilities with improved context handling, multi-step agent loops, and provider abstraction for Anthropic and Ollama.

## Scope (Phase 2)
- Context and resolution improvements.
- Multi-step agent loop (tool -> LLM -> tool feedback).
- Provider abstraction + Anthropic/Ollama support.

## Non-Goals
- MCP integrations.
- Collaboration features.
- Enterprise policy controls.

## Decisions Applied
- No explicit user confirmation between steps.

## Architecture Changes
- Agent loop with iterative tool calls:
  - LLM proposes plan
  - execute tool(s)
  - feed results back to LLM
  - repeat until completion
- Provider abstraction layer:
  - unified request/response format
  - per-provider adapters (OpenAI, Anthropic, Ollama)

## Context Improvements
- Fuzzy project resolution.
- Add active project inference.
- Improved, user-friendly errors.

## Provider Expansion
- Anthropic client integration.
- Ollama via OpenAI-compatible endpoint.
- Settings UI for provider + model selection.

## UI + UX
- Clear multi-step progress presentation in chat.

## Safety + Validation
- Continue schema validation per tool.
- Partial failure handling with recoverable error reporting.

## Testing Plan
- Unit tests for provider adapters.
- Integration tests for multi-step loops and partial failure recovery.

## Deliverables
- Multi-step agent loop.
- Provider abstraction + Anthropic/Ollama support.
- Enhanced context pipeline and error messaging.
