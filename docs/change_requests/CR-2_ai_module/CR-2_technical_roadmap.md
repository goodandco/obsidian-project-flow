# ProjectFlow Technical Roadmap – AI Module (Aligned with Change Request)

This roadmap follows the three phases defined in the Change Request.
Each phase is decomposed into concrete engineering stages.

- Phase = product / architectural milestone (from CR)
- Stage = implementation step inside that phase

---

## Phase 1 – Chat UI + OpenAI + Core Tools + Basic AgentPlan

(From CR: Chat UI, OpenAI integration, Core tools, basic AgentPlan execution, simple flows)

### Stage 1.1 – AI Module Skeleton (No LLM)

**Goals**
Establish chat UX and verify ProjectFlow Core integration.

**Deliverables**
- `enableAI` toggle in ProjectFlow settings
- Right-panel Chat View (only active when AI is enabled)
- Message input + history
- On each user message:
  - treat input as project tag only (no fuzzy matching)
  - call `resolveProject(userInput)`
  - render human-readable response

**Exit**
- AI can be enabled/disabled
- Chat resolves projects via Core
- Friendly text output (“Project not found.” / project details)

---

### Stage 1.2 – OpenAI Integration

**Goals**
Introduce real natural language input.

**Deliverables**
- OpenAI client
- Settings:
  - API key
  - model
  - base URL (OpenAI-compatible)
- Prompt construction using:
  - user message
  - selected text
  - active file
  - projectIndex snapshot
- Prepend to the user input:
  - `I'm going to create a project with tag ${input}`

**Exit**
- User input goes through OpenAI
- Assistant replies appear in chat

---

### Stage 1.3 – Tool Registry + AgentPlan Execution

**Goals**
Enable tool-only automation.

**Deliverables**
- Tool registry exposing ProjectFlow Core:
  - resolveProject
  - listEntityTypes
  - createProject
  - createEntity
  - patchMarker / patchSection
  - relationship helpers
- JSON schema definition per tool (for validation + model guidance)
- AgentPlan abstraction
- Executor applying tool calls sequentially

**Exit**
- LLM produces structured tool calls
- ProjectFlow executes them via Core
- No direct markdown access

---

### Stage 1.4 – First Simple Flows

**Goals**
Deliver initial user value.

**Examples**
- “add this to problog”
- create task from selection

**Exit**
- Natural language creates entities
- Chat confirms results
- Tool usage is shown in chat without requiring user confirmation

---

## Phase 2 – Anthropic / Ollama + Context + Multi-Step Agent

(From CR: Anthropic/Ollama support, improved context, multi-step agent loops)

---

### Stage 2.1 – Context & Resolution Improvements

**Deliverables**
- Better fuzzy project resolution
- Richer context:
  - selection
  - active note
  - active project
- Friendly error messages

**Exit**
- Ambiguous references handled correctly
- Errors are understandable

---

### Stage 2.2 – Multi-Step Agent Loop

**Deliverables**
- Tool → LLM → tool feedback loop
- Support for multiple actions per request
- Partial failure handling

**Exit**
- Complex workflows complete reliably

---

### Stage 2.3 – Provider Expansion

**Deliverables**
- Provider abstraction layer
- Anthropic integration
- Ollama via OpenAI-compatible endpoint
- UI for provider + model selection

**Exit**
- Same flows run on OpenAI, Anthropic, Ollama

---

## Phase 3 – MCP + Advanced Workflows + Collaboration

(From CR: MCP integrations, advanced workflows, collaboration-oriented features)

---

### Stage 3.1 – MCP Tool Support

**Deliverables**
- MCP client integration
- Unified tool registry (ProjectFlow + MCP)
- MCP server configuration support (no examples or mocks)

**Exit**
- Agent can call MCP and ProjectFlow tools in same flow

---

### Stage 3.2 – Workflow Hardening

**Deliverables**
- Conversation memory (local)
- Retry strategies
- Optional strict execution mode
- Tool execution logging

**Exit**
- Core workflows feel stable for daily use

---

### Stage 3.3 – Collaboration Preparation (Future)

**Potential Deliverables**
- Shared vault conventions
- Role-based tool restrictions
- Policy hooks
- Collaboration-oriented flows

(Not MVP.)

---

## Guiding Principles

- AI never edits markdown directly
- All writes go through ProjectFlow Core
- Agent operates strictly via tools
- Templates remain user-customizable
- Architecture stays local-first and deterministic

---

## MVP Definition (end of Phase 1)

ProjectFlow AI MVP is reached when:

- AI module can be enabled/disabled
- User can chat in ProjectFlow
- Natural language creates tasks / meetings / notes
- Project selection works from fuzzy references
- Core invariants are preserved
- OpenAI provider works
