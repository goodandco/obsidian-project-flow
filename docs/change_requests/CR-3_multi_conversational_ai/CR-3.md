# Conversational Agent with Intent Routing for Obsidian Plugin

## Goal

Transform the existing planner-first chat into a conversational agent that:

- Answers questions naturally
- Detects when the user wants actions
- Supports mixed (chat + action) requests
- Only invokes planning + tools when appropriate

Current problem:

User input always goes directly to planning, making the assistant feel like a workflow engine instead of a chat agent.

Target architecture introduces an Intent Layer.

---

## High-Level Architecture

Replace:

User → Planner → Confirmation → Agent Loop

With:

User → Intent Classifier → Router

Routes:

- chat     → Conversational LLM (no tools)
- action   → Planner → Confirmation → Agent Loop
- mixed    → Chat response → Offer action → Planner if confirmed
- unclear  → Clarifying question

Diagram:

User  
↓  
Intent Classifier  
↓  
┌──────── chat ─────────┐  
│ Conversational reply │  
└──────── action ──────┘  
            ↓  
         Planner  
            ↓  
      Confirmation  
            ↓  
        Agent Loop  

---

## Intent Types

```ts
export type Intent =
  | "chat"
  | "action"
  | "mixed"
  | "unclear";

```

**Definitions:**

- chat: user is asking questions or discussing concepts
- action: user explicitly wants to create/update/delete projects/tasks/etc
- mixed: both explanation + action request
- unclear: insufficient info


## Intent Classifier Prompt

### System:

You are an intent classifier for an Obsidian productivity assistant.

Classify the user input into exactly one of:

- chat
- action
- mixed
- unclear

###**Definitions:**

**chat**:
User is asking a question or discussing concepts. No execution requested.

**action**:
User explicitly requests operations such as creating, updating, deleting projects, tasks, notes, or structures.

**mixed**:
User asks a question AND requests an action in the same message.

**unclear**:
Not enough information to decide.

Respond ONLY with valid JSON:

{
"intent": "...",
"reason": "...",
"confidence": 0.0-1.0
}

Do not include markdown.

User:

{{input}}

## Routing Logic

In handleNewRequest:

```typescript

const intent = await classifyIntent(input);

switch (intent.intent) {
  case "chat":
    return handleChat(input);

  case "action":
    return handleAction(input);

  case "mixed":
    return handleMixed(input);

  case "unclear":
    return askClarification();
}

```

## Implementation Notes

- New module: `src/ai/domain/intent.ts` exports `classifyIntent(input: string)` and `Intent` types.
- `agent.ts` wires intent routing; `planner.ts` remains ACTION-only.
- Intent classification uses only the latest user message (no history).
- Intent model uses the same LLM as chat/planner for now; optimization can follow later.
- Mixed-flow confirmation uses the existing string-based affirmative/negative matcher.
- Mixed-flow offer text is configurable, with a default fallback (see UX Copy).
- If the intent classifier fails or returns invalid JSON, default to `chat`.

## UX Copy

Mixed-flow offer text is configurable via settings (default):

```
I can also set this up for you. Shall I proceed?
```

If settings are missing, fall back to the default text above.

### Chat Path

Chat path does NOT use tools or planner.

Prompt:

```markdown
You are a helpful Obsidian assistant.

Answer conversationally.
Do not propose plans unless explicitly asked.
Do not call tools.
If the user implies possible actions, suggest them softly.
```

Example of Implementation:

```typescript

async function handleChat(input: string) {
  const messages = [
    { role: "system", content: CHAT_PROMPT },
    ...history,
    { role: "user", content: input }
  ];

  const reply = await runChatCompletion({ messages });
  ui.appendMessage("assistant", reply);
}

```

### Action Path

This is an existing pipeline:

action → runPlanningStage → confirmation → runAgentLoop

No changes required except that it is now only triggered for intent === "action".


### Mixed Path

Steps:

1. First answer the question conversationally.
2. Then offer to perform the action.

Example UX:

```
Assistant:
(explains concept)

"I can also create this for you. Shall I proceed?"
```

If user confirms → enter Action Path.

Implementation sketch:


```typescript
async function handleMixed(input: string) {
  const chatReply = await runChatCompletion(...);

  ui.appendMessage("assistant", chatReply);
  ui.appendMessage("assistant", "I can also set this up for you. Shall I proceed?");
}

```

If user answers yes → call handleAction(originalInput).

### Unclear Path

Simply ask:

"Could you clarify what you'd like me to do?"

### Planner Prompt (Narrow Responsibility)

```markdown

You are a planning module for ProjectFlow AI.

IMPORTANT:
This planner is invoked ONLY after the system has already determined that the user intends to perform actions.
Assume the user intent is ACTION.

Your responsibilities:
- Produce a short step-by-step action plan
- Extract structured fields required for execution
- Detect missing required information

Return ONLY valid JSON with the following keys:

- needsFollowup (boolean)
- question (string)
- plan (string)
- context (string)
- fields (object)

Rules:

- Do NOT answer conversationally.
- Do NOT explain concepts.
- Do NOT decide whether action is needed.
- Do NOT execute tools.
- Prefer minimal plans (1–3 steps).
- Output JSON only.

Behavior:

If required information is missing:
- set needsFollowup=true
- ask ONE concise clarification question in "question"
- leave "plan", "context", and "fields" empty or minimal

If enough information is available:
- set needsFollowup=false
- provide:
  - a short step-by-step plan
  - a brief context summary
  - extracted fields

Fields must include required values for createEntity / createProject when applicable (for example: TITLE, DESCRIPTION).

Never include markdown. Never include commentary outside JSON.

```

## Testing

- Unit tests for intent routing in `agent.ts` (chat/action/mixed/unclear + invalid JSON fallback to chat).
- Unit tests for `classifyIntent` JSON parsing + error handling.
- 2–3 golden conversation fixtures covering:
  - chat only
  - action only
  - mixed with confirmation path
