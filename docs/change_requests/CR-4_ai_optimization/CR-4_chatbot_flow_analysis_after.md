# AI Chatbot Flow — After Issue #1 Fix

Compares against [CR-4_chatbot_flow_analysis.md](CR-4_chatbot_flow_analysis.md) (BEFORE state).

**Change**: `classifyIntent()` [LLM #1] + `runPlanningStage()` [LLM #2] merged into a single `runPlanningStage()` call that now also returns `intent`. Saves one LLM roundtrip on every action request.

---

## Logic Diagram (AFTER)

Legend: ╔══╗ = LLM call ┌──┐ = logic / routing → = data flow

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
          │         ┌──────────┴──────────┐              │ build tools +
          │         │  affirmative?       │              │ systemPrompt
          │         │   → handleAction    │              │
          │         │  negative?          │    ╔════════▼═══════════════════╗
          │         │   → cancel          │    ║  LLM CALL #1               ║
          │         └─────────────────────┘    ║  runPlanningStage()         ║
          │                                    ║  classify intent + plan     ║
          │                                    ║  up to 6 steps              ║
          │                                    ║  safe tools: listDimensions,║
          │                                    ║  resolveProject, etc.       ║
          │                                    ║  planner.ts                 ║
          │                                    ╚══════════╤══════════════════╝
          │                                               │ planResult.intent
          │                           ┌──────────┬────────┴──┬────────────────┐
          │                        "chat"    "action"     "mixed"         "unclear"
          │                           │          │           │                │
          │                           ▼          │           ▼           ┌──────────┐
          │              ╔════════════════════╗  │  ╔══════════════════╗ │"Clarify?"│
          │              ║  LLM CALL #2       ║  │  ║  LLM CALL #2     ║ │(no LLM)  │
          │              ║  handleChatRequest ║  │  ║  handleChatReq   ║ └──────────┘
          │              ║  1 streaming call  ║  │  ║  1 streaming     ║
          │              ║  no tools          ║  │  ║  no tools        ║
          │              ╚════════════════════╝  │  ╚══════════════════╝
          │                                      │       + offer action
          │                                      │       pendingMixedInput = ✓
          │                                      │
          │                              plan already in planResult
          │                              no extra LLM call needed ↓
          │                                      │
          │            needsFollowup=true    needsFollowup=false
          │                 │                    │
          │                 ▼                    ▼
          │    ┌────────────────────────┐  ┌────────────────────────┐
          │    │  Save PendingPlan      │  │  Show plan to user     │
          │    │  status="clarifying"   │  │  Save PendingPlan      │
          │    │  Show question to user │  │  status="awaiting_     │
          │    │  Wait for next message │  │    confirmation"       │
          └───►│  → loops back here     │  │  Show confirm buttons  │
               └────────────────────────┘  └───────────┬────────────┘
                  ▲   user clarifies                    │
                  │  (re-runs planner)                  │
                  │   via handleFollowup  User confirms ✓
                  │                                     │
                  │                                     ▼
                  │                      ╔════════════════════════════════════╗
                  │                      ║  LLM CALL #2+ (per step)           ║
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

## LLM Calls Summary (AFTER)

| Stage                      | LLM Calls                 | Tools?                                                     | Purpose                                       |
| -------------------------- | ------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Classify + plan (combined) | up to 6 steps             | Yes (safe tools: `listDimensions`, `resolveProject`, etc.) | Classify intent AND generate plan in one call |
| Chat request               | 1 streaming               | No                                                         | Conversational answer                         |
| Agent loop                 | N (max 6 steps)           | Yes (full registry)                                        | Execute actions via tools                     |
| Specialized agent          | N (own loop, max 5 steps) | Yes (scoped to project type)                               | Create entities                               |

**Action path before agent loop: 1 call — was 2**

---

## What Changed

|                              | BEFORE                                                                       | AFTER                                                |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `handleNewRequest()` calls   | `classifyIntent()` → branch → `handleActionRequest()` → `runPlanningStage()` | `runPlanningStage()` → branch on `planResult.intent` |
| LLM calls for action request | 2 (classify + plan sequentially)                                             | 1 (classify + plan in one call)                      |
| `classifyIntent()`           | Called every new request                                                     | Removed from main flow (still exported)              |
| `handleMixedRequest()`       | Private method                                                               | Removed — logic inlined in `handleNewRequest()`      |
| `handleActionRequest()`      | Called from `handleNewRequest()` for action                                  | Only called from `handleMixedFollowup()`             |
| `PLANNER_PROMPT`             | Plan generation only                                                         | Extended with intent classification rules            |
| `PlanningResult`             | `{ needsFollowup, question, plan, context, fields }`                         | `+ intent?, confidence?`                             |

## Files Changed

- `src/ai/types/planning.ts` — added `intent?: Intent`, `confidence?: number`
- `src/ai/domain/intent.ts` — exported `normalizeIntent()`
- `src/ai/domain/planner.ts` — extended `PLANNER_PROMPT`, updated `parsePlannerJson()`
- `src/ai/handlers/chat.ts` — rewrote `handleNewRequest()`, removed `classifyIntent` import and dead `handleMixedRequest()`
