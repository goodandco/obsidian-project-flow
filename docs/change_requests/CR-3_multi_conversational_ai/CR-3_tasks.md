# CR-3 Tasks

## Phase 1: Intent Routing Core
- T1: Add `src/ai/domain/intent.ts` with `Intent` types and `classifyIntent(input)`.
- T2: Implement intent classifier prompt + JSON parsing with safe fallback to `chat`.
- T3: Wire `agent.ts` to route by intent (chat/action/mixed/unclear).
- T4: Ensure `planner.ts` remains ACTION-only (no intent detection).

## Phase 2: Mixed Flow + UX Config
- T5: Add configurable mixed-flow offer text with default fallback.
- T6: Use existing affirmative/negative matcher to confirm mixed flow action.
- T7: Handle `unclear` intent with a clarification prompt in chat UI.

## Phase 3: Tests + Fixtures
- T8: Unit tests for intent routing decisions in `agent.ts`.
- T9: Unit tests for `classifyIntent` JSON parsing + error handling.
- T10: Add 2–3 golden conversation fixtures (chat/action/mixed w/ confirmation).

## Completion Criteria
- Intent routing works with chat-first UX and action pipeline intact.
- Mixed flow offers configurable copy and respects user confirmation.
- Invalid classifier output defaults to chat without breaking UX.
- Tests and fixtures pass.
