# Issue #2 — Replace Project Index Snapshot with `listProjects` Tool

## Problem

Every system prompt includes the full serialized `ProjectIndex` at `prompts.ts:49`:

```typescript
`Project index snapshot: ${projectIndex ? JSON.stringify(projectIndex) : "(none)"}`,
```

`ProjectIndex` has **three lookup maps** — `byFullName`, `byId`, `byTag` — each containing every project. A vault with 50 projects serializes ~150 entries (the same data three times over), costing 5–20 KB of tokens on **every single request**, regardless of whether the AI needs project data at all.

---

## Root Cause

The index was added as a static context shortcut so the LLM could "see" available projects without making a tool call. This made sense as a first pass but doesn't scale. The planner and agent both already have access to safe tools during their loops — a `listProjects` tool is the correct, on-demand alternative.

Notably, `safety.ts` already whitelists `"listProjects"` (line 6), but no such tool exists in `registry.ts`. The whitelist entry is dead weight.

---

## Solution

Two changes, no new files:

1. **Remove** the `Project index snapshot` line from `buildSystemPrompt()`.
2. **Add** a `listProjects` tool to `createToolRegistry()` backed by `api.listProjects()`.

The LLM retains full project awareness on demand. The planner calls `listProjects` when it needs to search or reference a project; if the active project or chat project context is already set, it doesn't need to call it at all (those are still present in the system prompt).

---

## Files to Modify

| File                          | Change                                            |
| ----------------------------- | ------------------------------------------------- |
| `src/ai/domain/prompts.ts`    | Remove line 49 (`Project index snapshot`)         |
| `src/ai/adapters/registry.ts` | Add `listProjects` tool to `createToolRegistry()` |

No changes to `safety.ts` (already has `"listProjects"`), `resolve-service.ts`, or `api/handlers/projects.ts`.

---

## Step 1 — `src/ai/domain/prompts.ts`

Remove line 49. No other changes.

```typescript
// REMOVE this line:
`Project index snapshot: ${projectIndex ? JSON.stringify(projectIndex) : "(none)"}`,
```

Also remove the now-unused `projectIndex` variable on line 22:

```typescript
// REMOVE this line:
const projectIndex = plugin.settings.projectIndex;
```

---

## Step 2 — `src/ai/adapters/registry.ts`

Add the `listProjects` tool after `resolveProject` (after line 50). It uses `api.listProjects()` which already exists in `src/api/handlers/projects.ts`.

```typescript
{
  name: "listProjects",
  description: "List all projects in the vault. Returns an array of project entries with fullName, projectId, projectTag, dimension, category, projectName, and parent. Use this to find a project when you only know its name or need to browse available projects.",
  schema: { type: "object", properties: {}, additionalProperties: false },
  handler: async () => api.listProjects(),
},
```

---

## What the Tool Returns

`api.listProjects()` returns `ProjectIndexEntry[]` — a flat array, not three maps:

```typescript
interface ProjectIndexEntry {
  fullName: string; // e.g. "Work.Client.my-project"
  projectId: string; // e.g. "my-project"
  projectTag: string; // e.g. "project/my-project"
  path: string; // vault-relative folder path
  dimension: string; // e.g. "Work"
  category: string; // e.g. "Client"
  projectName: string; // e.g. "My Project"
  parent: string | null;
}
```

This is cleaner than the current dump: one entry per project instead of three copies spread across lookup maps.

---

## What Stays in the System Prompt

The system prompt already includes single-project context that covers the most common cases:

```
Active project: project/my-project (Work.Client.my-project)
Chat project context: my-project-id (project/my-project)
```

If either is set, the LLM typically does not need to call `listProjects` at all. The tool is only needed when the user references a project by name that isn't the active one, or asks "what projects do I have?".

---

## Token Impact

| Scenario    | Before                  | After                                       |
| ----------- | ----------------------- | ------------------------------------------- |
| 10 projects | ~3–6 KB every request   | 0 KB in prompt; tool result ~1 KB on demand |
| 50 projects | ~15–30 KB every request | 0 KB in prompt; tool result ~5 KB on demand |
| 0 projects  | ~50 bytes (`"(none)"`)  | 0 KB                                        |

---

## Behaviour After the Change

| User request                         | AI behaviour                                                            |
| ------------------------------------ | ----------------------------------------------------------------------- |
| "Create a task in my active project" | Uses `Chat project context` from prompt — no `listProjects` call needed |
| "Create a task in the Work project"  | Planner calls `listProjects` to find the right tag, then proceeds       |
| "What projects do I have?"           | Chat handler responds; may call `listProjects` in agent loop            |
| `resolveProject` by known tag        | Works as before — `resolveProject` tool is unchanged                    |

---

## Verification

1. **Build**: `npm run build` — no type errors.
2. **Tests**: `npm test` — existing tests unaffected (no tests cover `buildSystemPrompt` output text directly).
3. **Manual**:
   - Open the AI chat, send any message — confirm no `Project index snapshot` line in the system prompt (add a temporary `console.log` if needed).
   - Ask "what projects do I have?" — LLM should call `listProjects` and return a list.
   - Ask "create a task in [project name]" with no active project — planner should call `listProjects`, find the project, then proceed with `delegateToProjectAssistant`.
   - Verify chat project context flow still works when a project is pinned.
