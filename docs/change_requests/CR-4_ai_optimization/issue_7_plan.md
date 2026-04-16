# Fix Issue #7 — Conversation Persist Can Lose Data on Plugin Unload

## Problem

Conversation data is persisted via a debounced async write (`setTimeout` 400ms → `writeNow()`). There is a broken async chain across three layers that prevents the flush from completing before Obsidian tears down the plugin:

```
view.onClose()          ← async, Obsidian awaits this
  controller.onClose()  ← void (no await), returns synchronously
    state.flushConversation()  ← void (fire-and-forget)
      void this.writeNow()     ← async, never awaited
```

Because every link in this chain is fire-and-forget, calling `view.onClose()` starts the write but does **not** wait for it to complete. Obsidian sees `onClose()` resolve immediately and proceeds to destroy the plugin context — often before `writeNow()` finishes the disk write.

### Data loss scenarios

| Scenario                                     | Why data is lost                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Obsidian quit / plugin disable               | `onunload()` → `detachLeavesOfType()` → `onClose()` resolves before disk write finishes |
| User appends message then immediately closes | 400ms timer pending; `flushConversation()` starts write but caller doesn't wait         |
| Plugin crash / forced reload                 | Timer never fires, no flush triggered at all                                            |
| `writeNow()` filesystem error                | Error silently swallowed by `catch {}`; no retry, no signal                             |

---

## Root Cause Breakdown

### 1. `flushConversation()` — `conversation.ts:231`

```typescript
// current — fire and forget
flushConversation(): void {
  if (this.persistTimer) {
    window.clearTimeout(this.persistTimer);
    this.persistTimer = null;
  }
  void this.writeNow();   // ← async call discarded with void
}
```

`writeNow()` is `async` and takes a non-trivial amount of time (vault adapter I/O). Calling it with `void` and returning `void` from `flushConversation()` means callers have no way to know when the write completes.

### 2. `AiChatController.onClose()` — `chat.ts`

```typescript
// current — synchronous
onClose(): void {
  this.state.flushConversation();
}
```

Returns `void`, so `view.onClose()` cannot await it even if it wanted to.

### 3. `view.onClose()` — `view.ts:123`

```typescript
// current — does not await controller
async onClose(): Promise<void> {
  this.controller?.onClose();   // ← not awaited; void call
  // cleanup ...
}
```

`view.onClose()` is `async` and Obsidian does await it. But because `controller.onClose()` is `void`, the view resolves immediately — the disk write hasn't started yet in any meaningful awaitable way.

---

## Solution: Fix the Async Chain

Make each layer properly `async` and `await` the layer below it. This is a three-file change with no logic changes — only return type promotions and `await` additions.

### Files to Modify

| File                            | Change                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `src/ai/domain/conversation.ts` | `flushConversation()` → `async`, returns `Promise<void>`, awaits `writeNow()` |
| `src/ai/handlers/chat.ts`       | `onClose()` → `async`, returns `Promise<void>`, awaits `flushConversation()`  |
| `src/ai/adapters/view.ts`       | `onClose()` awaits `controller.onClose()`                                     |

---

## Step 1 — `src/ai/domain/conversation.ts`

Change `flushConversation()` from `void` to `async Promise<void>` and await `writeNow()`:

```typescript
// before
flushConversation(): void {
  if (this.persistTimer) {
    window.clearTimeout(this.persistTimer);
    this.persistTimer = null;
  }
  void this.writeNow();
}

// after
async flushConversation(): Promise<void> {
  if (this.persistTimer) {
    window.clearTimeout(this.persistTimer);
    this.persistTimer = null;
  }
  await this.writeNow();
}
```

No other changes to `conversation.ts`. `writeNow()` already has a `try/catch` and handles errors gracefully — the caller now simply waits for it to settle.

---

## Step 2 — `src/ai/handlers/chat.ts`

Change `onClose()` from `void` to `async Promise<void>` and await the flush:

```typescript
// before
onClose(): void {
  this.state.flushConversation();
}

// after
async onClose(): Promise<void> {
  await this.state.flushConversation();
}
```

---

## Step 3 — `src/ai/adapters/view.ts`

In `onClose()`, `await` the controller's close instead of calling it fire-and-forget:

```typescript
// before
async onClose(): Promise<void> {
  this.controller?.onClose();
  this.messageContainer = null;
  // ... rest of cleanup
}

// after
async onClose(): Promise<void> {
  await this.controller?.onClose();
  this.messageContainer = null;
  // ... rest of cleanup
}
```

`this.controller?.onClose()` now returns `Promise<void> | undefined`. The `await` on `undefined` is a no-op, so the guard is safe.

---

## Why This Is Sufficient

Obsidian's plugin lifecycle:

1. **Plugin disable / Obsidian quit**: Obsidian calls `plugin.onunload()`, which calls `this.app.workspace.detachLeavesOfType(AI_VIEW_TYPE)`. Detaching a leaf calls the view's `onClose()`. Because `ItemView.onClose()` is declared `async Promise<void>` in Obsidian's API, Obsidian awaits it before continuing teardown.

2. **With the fix applied**: `view.onClose()` now awaits `controller.onClose()`, which awaits `state.flushConversation()`, which awaits `writeNow()`. The disk write is complete before `onClose()` resolves — and therefore before Obsidian proceeds.

3. **`resetController()` in `view.ts`**: Also calls `this.controller?.onClose()` (line 322) when switching conversations. This call should also be awaited to prevent data loss during conversation switching. Update it to `await this.controller?.onClose()` and make `resetController()` async.

---

## Additional Fix: `resetController()` in `view.ts`

`resetController()` calls `controller.onClose()` fire-and-forget when switching conversations:

```typescript
// before
private resetController(): void {
  if (!this.state) return;
  this.controller?.onClose();
  this.controller = new AiChatController(this.plugin, this, this.state);
}

// after
private async resetController(): Promise<void> {
  if (!this.state) return;
  await this.controller?.onClose();
  this.controller = new AiChatController(this.plugin, this, this.state);
}
```

All three callers of `resetController()` (`handleNewConversation`, `selectConversation`, `handleRemoveConversation`) must be updated to `await this.resetController()`.

---

## What Does NOT Change

- `persistConversation()` debounce logic — unchanged (still 400ms; guards normal write load)
- `writeNow()` — unchanged (already async, already has try/catch)
- `appendMessage()`, `setPendingPlan()` etc. — unchanged
- Agent loop, planner, tool registry — not affected

---

## Scope Summary

| File              | Lines changed | Type of change                                                                                    |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| `conversation.ts` | ~3            | `void` → `async Promise<void>`, `void this.writeNow()` → `await this.writeNow()`                  |
| `chat.ts`         | ~3            | `void` → `async Promise<void>`, `this.state.flush()` → `await this.state.flush()`                 |
| `view.ts`         | ~8            | `this.controller?.onClose()` → `await this.controller?.onClose()`, `resetController()` goes async |

---

## Verification

1. **Build**: `npm run build` — no type errors (return type widening from `void` to `Promise<void>` is backward-compatible at call sites that don't await).
2. **Manual test — normal close**: Open chat, send a message, immediately close Obsidian. Reopen — message must still be present.
3. **Manual test — conversation switch**: Send a message, switch conversation immediately. Reopen — message in the original conversation must persist.
4. **Manual test — plugin reload**: Send a message, disable and re-enable the plugin. Conversation must be intact.
5. **Regression**: Conversation clearing, renaming, and deletion still work correctly.
