# CR-2 Phase 3 Implementation Plan

## Goal
Enable MCP tool integrations, harden workflows for daily use, and prepare collaboration-oriented capabilities.

## Scope (Phase 3)
- MCP client integration and configurable MCP servers.
- Workflow hardening (memory, retries, logging).
- Collaboration preparation (policy hooks and shared conventions).

## Non-Goals
- Shipping specific MCP server examples or mocks.
- Full collaboration features or multi-user sync.

## Architecture Changes
- MCP client and tool registry integration:
  - MCP tools treated the same as Core tools
  - unified schema validation
- Local conversation memory storage.
- Execution logging and optional strict mode.

## MCP Integration
- Settings to add/remove MCP servers.
- Tool discovery and registration from MCP.
- No bundled MCP servers.

## Workflow Hardening
- Retry strategies for tool and LLM errors.
- Local conversation memory.
- Persist multi-stage clarification context (pending plan state across user follow-ups).
- Strict execution mode toggle.
- Tool execution audit log.

## Collaboration Preparation
- Policy hooks for tool restrictions.
- Shared vault conventions (docs only).
- Role-based tool restrictions (scaffold only).

## Testing Plan
- Integration tests for MCP tool execution.
- Regression tests for tool logging and retry behavior.

## Deliverables
- MCP client integration with configurable servers.
- Workflow hardening features.
- Collaboration-oriented scaffolding and documentation.
