# AI Chatbot Flow — Analysis & Optimization Plan

## Logic Diagram

Legend:  ╔══╗ = LLM call   ┌──┐ = logic / routing   → = data flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER SENDS MESSAGE                                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                      ┌──────────▼────────────┐
                      │     handleSend()      │
                      │  AI enabled? API key? │
                      └──────────┬────────────┘
                                 │
             ┌───────────────────┼───────────────────────┐
             │ No API key        │                       │ AI disabled
             ▼                   │                       ▼
  ┌──────────────────┐           │             ┌──────────────────┐
  │ handleTagLookup  │           │             │  "AI is disabled"│
  │ (tag lookup,     │           │             └──────────────────┘
  │  no LLM)         │           ▼
  └──────────────────┘   ┌────────────────┐
                         │  handleLLM()   │
                         └───────┬────────┘
                                 │
          ┌──────────────────────┼───────────────────────┐
          │ pendingPlan?         │ pendingMixedInput?    │ (neither)
          ▼                      ▼                       ▼
  ┌───────────────┐   ┌────────────────────┐   ┌────────────────────┐
  │ handleFollowup│   │ handleMixedFollowup│   │  handleNewRequest()│
  └───────┬───────┘   └────────┬───────────┘   └─────────┬──────────┘
          │                    │                         │
          │         ┌──────────┴──────────┐              │
          │         │  affirmative?       │    ╔════════▼═════════════╗
          │         │   → handleAction    │    ║  LLM CALL #1         ║
          │         │  negative?          │    ║  classifyIntent()    ║
          │         │   → cancel          │    ║  1 call · no tools   ║
          │         └─────────────────────┘    ║  intent.ts           ║
          │                                    ╚══════════╤═══════════╝
          │                                               │
          │                           ┌──────────┬────────┴──┬────────────────┐
          │                        "chat"    "action"     "mixed"         "unclear"
          │                           │          │           │                │
          │                           ▼          │           ▼                ▼
          │              ╔════════════════════╗  │  ╔══════════════════╗ ┌──────────┐
          │              ║  LLM CALL #2       ║  │  ║  LLM CALL #2     ║ │"Clarify?"│
          │              ║  handleChatRequest ║  │  ║  handleChatReq   ║ │(no LLM)  │
          │              ║  1 streaming call  ║  │  ║  1 streaming     ║ └──────────┘
          │              ║  no tools          ║  │  ║  no tools        ║
          │              ║  chat.ts           ║  │  ╚══════════════════╝
          │              ╚════════════════════╝  │       + offer action
          │                                      │       pendingMixedInput = ✓
          │                    ┌─────────────────┘
          │                    ▼
          │    ┌───────────────────────────────────────┐
          │    │         handleActionRequest()         │
          │    │  createToolRegistry (main tools)      │
          │    │  loadMcpToolRegistry (MCP tools)      │
          │    │  filterSafeTools → safe subset        │
          │    │  buildSystemPrompt                    │
          │    └───────────────────┬───────────────────┘
          │                        │
          │           ╔════════════▼═════════════════════════╗
          │           ║  LLM CALL #2 (action)                ║
          │           ║  runPlanningStage()                  ║               
          │           ║  up to 6 steps                       ║               
          │           ║  safe tools: listDimensions,         ║               
          │           ║  resolveProject, listProjects,       ║               
          │           ║  listEntityTypes, etc.               ║               
          │           ║  planner.ts                          ║               
          │           ╚═════╤════════════════════════════════╝               
          │                 │               ▲             │              
          │            needsFollowup=true   │       needsFollowup=false 
          │                 │               │             │             
          │                 ▼               │             ▼             
          │    ┌────────────────────────┐   │     ┌────────────────────────┐  
          │    │  Save PendingPlan      │   │     │  Show plan to user     │  
          │    │  status="clarifying"   │   │     │  Save PendingPlan      │  
          │    │  Show question to user │   │     │  status="awaiting_     │  
          │    │  Wait for next message │   │     │    confirmation"       │  
          └───►│  → loops back here     │   │     │  Show confirm buttons  │  
               └────────────────────────┘   │     └───────────┬────────────┘  
                  ▲   user clarifies        │                 │             
                  │  (re-runs planner) ────►┘                 │
                  │                User confirms ✓            │
                  │                                           │
                  │                                           ▼
                  │                      ╔════════════════════════════════════╗
                  │                      ║  LLM CALL #3+ (per step)           ║
                  │                      ║  runAgentLoop()                    ║
                  │                      ║  up to 6 streaming calls           ║
                  │                      ║  full tool registry                ║
                  │                      ║  agent.ts                          ║
                  │                      ╚════════════════╤═══════════════════╝
                  │                                       │
                  │                            tool call requested?
                  │                             ┌─────────┴──────────┐
                  │                             │                    │
                  │                   ┌─────────▼──────┐   ┌─────────▼──────────┐
                  │                   │  Direct tools   │  │ delegateToProject  │
                  │                   │  resolveProject │  │ Assistant()        │
                  │                   │  createProject  │  └─────────┬──────────┘
                  │                   │  patchMarker    │            │
                  │                   │  patchSection   │            ▼
                  │                   │  getChildren    │   ╔═════════════════════╗
                  │                   │  getParents     │   ║  LLM CALL (nested)  ║
                  │                   │  (no LLM)       │   ║  Specialized agent  ║
                  │                   └─────────────────┘   ║  up to 5 steps      ║
                  │                                         ║  scoped tools only: ║
                  │                                         ║  createTask,        ║
                  │                                         ║  createLesson,      ║
                  │                                         ║  createMeeting, etc.║
                  │                                         ║  specialized-       ║
                  │                                         ║  agent.ts           ║
                  │                                         ╚══════════╤══════════╝
                  │                                                    │
                  │                                                    ▼
                  │                                         api.createEntity() [no LLM]
                  │
                  └── loop repeats until: no tool calls / max steps /
                        error in strict mode / missing required fields
```

---

## LLM Calls Summary

| Stage | LLM Calls | Tools? | Purpose |
|---|---|---|---|
| Intent classification | 1 | No | Route to chat / action / mixed / unclear |
| Planning stage | up to 6 steps | Yes (safe tools: `listDimensions`, `resolveProject`, etc.) | Generate plan, detect missing info, resolve dimensions |
| Chat request | 1 streaming | No | Conversational answer |
| Agent loop | N (max 6 steps) | Yes (full registry) | Execute actions via tools |
| Specialized agent | N (own loop, max 5 steps) | Yes (scoped to project type) | Create entities |

**State that persists across messages:**
- `pendingPlan` — survives page reload (stored in `settings.ai.pendingPlan`), drives clarification/confirmation loops
- `pendingMixedInput` — in-memory only, offers action after answering a mixed question
- `projectContext` — in-memory, set after `resolveProject`/`createProject` succeeds, auto-injects `projectRef` into subsequent tool calls

---

## Issues Found

### HIGH Severity

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | Redundant LLM call — classify then plan (2 sequential calls for every action) | `chat.ts:270`, `chat.ts:332` | ~1s extra latency per action request |
| 2 | Full project index serialized into every system prompt | `prompts.ts:49` | 5–20 KB tokens per request for large vaults |
| 3 | Tool registry rebuilt 2–3× per request | `chat.ts:96`, `chat.ts:312` | Redundant JSON serialization |
| 4 | MCP tools fetched via HTTP on every action | `mcp/client.ts:11-29` | N network roundtrips per action |
| 5 | Agent content accumulates on retry — duplicate UI text | `agent.ts:96` | Duplicated text shown to user |
| 6 | No timeout on tool execution | `agent.ts` / `tool-executor.ts` | Potential infinite hang |
| 7 | Conversation persist can lose data on plugin unload | `conversation.ts` | Silent data loss |

### MEDIUM Severity

| # | Issue | Location | Impact |
|---|---|---|---|
| 8 | Entity requirements merged 3× per request | `prompts.ts:74-100` | Redundant recursive iteration |
| 9 | Silent intent classification fallback | `intent.ts:46` | User unaware of LLM parse failures |
| 10 | Hardcoded safe tools whitelist | `safety.ts:4-14` | New tools must be manually listed |
| 11 | MCP tools auto-trusted if name contains `:` | `safety.ts:15` | Security concern |
| 12 | Missing fields extraction parses error strings | `safety.ts:21` | Breaks silently if format changes |
| 13 | Specialized agent message extraction assumes last = assistant | `specialized-agent.ts:55-59` | Returns wrong final message |
| 14 | No conversation size limit | `conversation.ts` | Slow persist for long conversations |
| 15 | Active project inference scans full index on every prompt | `context.ts:4-21` | O(n) per request |

### LOW Severity

| # | Issue | Location | Impact |
|---|---|---|---|
| 16 | Linear backoff, no jitter | `agent.ts:134` | Thundering herd on retry |
| 17 | Anthropic `max_tokens` hardcoded to 1024 | `anthropic-client.ts:20` | May truncate complex responses |
| 18 | Planner mutates input `messages` array | `planner.ts:98`, `planner.ts:108` | Subtle state aliasing |
| 19 | Conversation window filtered 5+ times per request | `conversation.ts:89-95` | Minor array allocation overhead |
| 20 | Tool results serialized twice (state + messages) | `agent.ts:164-178` | Duplication in memory |

---

## Optimization Plan

### Phase 1 — Merge Intent Classification into Planning

**Problem**: Every action request makes 2 sequential LLM calls — `classifyIntent()` then `runPlanningStage()` — adding ~1s latency. The planner already has enough context to determine intent.

**Approach**: Add an `intent` field to `PlanningResult` and extend the planner prompt to also classify intent, eliminating the separate classification call.

**Files**:
- `src/ai/domain/planner.ts` — Extend `PLANNER_PROMPT` (line 10) to include intent classification. Update `parsePlannerJson()` (line 119) to extract `intent` field.
- `src/ai/types/planning.ts` — Add `intent?: Intent` and `confidence?: number` to `PlanningResult`.
- `src/ai/handlers/chat.ts` — Rewrite `handleNewRequest()` (line 261). Call `runPlanningStage()` once with safe tools. Branch on `planResult.intent`:
  - `"chat"` → forward to `handleChatRequest()` (plan result discarded)
  - `"action"` → proceed to confirmation (plan already computed)
  - `"mixed"` → chat response + offer action
  - `"unclear"` → ask clarification
- `src/ai/domain/intent.ts` — Keep `classifyIntent()` exported but no longer called from main flow.

**Risk**: Combined prompt is slightly more complex. Fallback: if `intent` missing/unparseable, default to `"chat"`.
**Saves**: 1 full LLM roundtrip per action/mixed request.

---

### Phase 2 — Cache Tool Registry and MCP Tools

**Problem**: `createToolRegistry()` + `loadMcpToolRegistry()` called 2–3× per request. MCP loading makes fresh HTTP requests to all servers every time.

**Approach**: Add a per-controller cache with TTL for MCP tools.

**Files**:
- `src/ai/handlers/chat.ts` — Add `private toolCache` to `AiChatController`. Add `private async getTools()` returning cached or freshly built tools. Invalidate on `clearConversation()`. Replace all 3 call sites with `this.getTools()`.
- `src/ai/mcp/client.ts` — Add module-level cache keyed by server URL with 5-minute TTL.

**Risk**: Stale MCP definitions mid-session. 5-minute TTL is acceptable.

---

### Phase 3 — Remove Project Index from System Prompt

**Problem**: `prompts.ts:49` serializes the entire `projectIndex` into every system prompt — 5–20 KB of tokens even for simple chat.

**Approach**: Replace the index dump with a `searchProjects` tool the LLM can call on demand.

**Files**:
- `src/ai/domain/prompts.ts` — Remove `JSON.stringify(projectIndex)`. Replace with: `"To find projects, use the searchProjects tool. There are N projects in the vault."`. Keep active project + chat project context inline (single entries).
- `src/ai/adapters/registry.ts` — Add `searchProjects` tool: `{ query, limit? }` → delegates to `findProjectMatches()`.
- `src/ai/domain/safety.ts` — Add `"searchProjects"` to `safeNames` set.

**Risk**: LLM may not call `searchProjects` when needed. Mitigation: clear instructions in system prompt; keep current/chat project context inline.

---

### Phase 4 — Memoize Entity Requirements

**Problem**: `getEntityRequirementsSummary()` calls `mergeProjectTypes()` + `mergeEntityTypes()` for every project type. Called up to 3× per request.

**File**: `src/ai/domain/prompts.ts` — Add module-level cache keyed on settings hash. Auto-invalidates when settings change (key mismatch).

---

### Phase 5 — Agent Loop Reliability

**5a. Fix content duplication on retry** (`src/ai/handlers/agent.ts:96`)
Reset `assistantContent`, `assistantEl`, and `toolCallsAccumulator` at the start of each retry attempt (inside `while(true)`, before `try`).

**5b. Add tool execution timeout** (`src/ai/handlers/tool-executor.ts`)
Wrap `tool.handler()` in `Promise.race` with a 30-second timeout. Return `{ ok: false, error: "Tool execution timed out" }`. Exclude `delegateToProjectAssistant`.

**5c. Fix specialized agent message extraction** (`src/ai/handlers/specialized-agent.ts:55-59`)
Scan `messages` backwards to find the last `role: "assistant"` message with non-empty content instead of assuming last message is assistant.

**5d. Improve conversation persistence** (`src/ai/domain/conversation.ts`)
Await `writeNow()` in `flushConversation()`. Log errors via `console.warn`. Register `onunload` handler.

**5e. Exponential backoff with jitter** (`src/ai/handlers/agent.ts:134`)
Change `delay(300 * attempt)` → `delay(300 * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5))`.

---

### Phase 6 — Safety and Robustness

**6a. Declarative safe tool marking**
Add `safe?: boolean` to `ToolDefinition`. Mark read-only tools at definition time. `filterSafeTools()` becomes `tools.filter(t => t.safe)`. Default MCP tools to `safe: false`.

Files: `src/ai/types/tools.ts`, `src/ai/adapters/registry.ts`, `src/ai/domain/safety.ts`.

**6b. Structured missing fields**
Entity creation handlers return/throw a typed error with `missingFields: string[]`. `extractMissingFields()` checks the property instead of parsing strings.

Files: `src/ai/domain/safety.ts`, `src/services/entity-service.ts`.

**6c. Intent fallback notification**
When planner output is unparseable, show: "I had trouble understanding that. Could you rephrase?" instead of silently routing to chat.

---

### Phase 7 — Minor Improvements

- **Conversation size limit** (`src/ai/domain/conversation.ts`): trim oldest messages if `messages.length > 500`.
- **Anthropic `max_tokens`** (`src/ai/providers/anthropic-client.ts`): make configurable via `AISettings`, default `4096`.

---

## Implementation Order

```
Phase 2 (caching)     — independent, low risk, immediate perf win
Phase 5 (reliability) — independent, fixes real bugs
Phase 1 (merge calls) — biggest latency win
Phase 3 (project idx) — depends on Phase 2 (new tool needs registry)
Phase 4 (memoize)     — independent, simple
Phase 6 (safety)      — independent, medium effort
Phase 7 (minor)       — independent, lowest priority
```

---

## Verification

1. `npm test` — existing + new unit tests for planner parsing, tool cache invalidation, `searchProjects` results, exponential backoff, structured missing fields errors.
2. Manual testing in Obsidian vault:
   - Chat message → verify no planning call (check console)
   - Action message → verify single LLM call (was 2)
   - Trigger MCP reload → verify TTL respected
   - Large vault (500+ projects) → verify prompt size reduced
   - Force tool timeout → verify graceful error message
   - Rapid messages then close plugin → verify conversation persisted
3. `npm run build` — must pass with no type errors.
