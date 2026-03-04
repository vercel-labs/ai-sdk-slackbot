# Plan: Slack Thinking Stream (chat.startStream / appendStream / stopStream)

## Goal

Show a native Slack "Thinking…" task-progress UI while the agent is running, using the same
`chat.startStream` / `chat.appendStream` / `chat.stopStream` pattern already implemented in d0.

## How it works in d0 (source of truth)

| File | Role |
|---|---|
| `lib/slack/thinking-stream.ts` | Thin wrappers over `client.apiCall(...)` for the three methods + shared types |
| `lib/slack/thinking-stream-manager.ts` | Stateful manager: start → appendStream on each tool call → stopStream when done |

The manager is instantiated in the event handler, passed into `generateResponse`, and its hooks
(`addToolStart`, `completeCurrentTool`, `errorCurrentTool`) are called from inside tool `execute`
callbacks so the UI updates in real time.

---

## Files to create / modify

### 1. `lib/thinking-stream.ts` ← new file (port from d0)

Direct copy of `d0/.../thinking-stream.ts` with no changes needed — it only depends on
`@slack/web-api` which dshelp-agent already uses.

Types exported: `TaskUpdateChunk`, `ThinkingChunk`, `StartStreamBody`, `AppendStreamBody`,
`StopStreamBody`, `TaskDisplayMode`, `TaskStatus`

Functions exported: `startStream`, `appendStream`, `stopStream`, `createTaskUpdate`,
`createMarkdownText`

---

### 2. `lib/thinking-stream-manager.ts` ← new file (adapted from d0)

Same class structure as d0's `ThinkingStreamManager`, but with tool titles mapped to
dshelp-agent's actual tools:

| Tool name | Running title | Completed title |
|---|---|---|
| `searchChannelHistory` | `Searching channel history` | `Searched channel history` |
| `createTicket` | `Creating DSE ticket` | `Created DSE ticket` |
| *(classify is not a tool call)* | — | — |

Remove all d0-specific tools (`ExecuteSQL`, `bashTool`, `webSearch`, `vRayProfile`, etc.).

Drop the d0-specific error formatting helpers (`getUserFacingErrorCode`,
`isFunctionInvocationTimeoutError`, etc.) and replace with simple `error instanceof Error ?
error.message : String(error)`.

Constructor options:
```ts
interface ThinkingStreamManagerOptions {
  client: WebClient;
  channel: string;
  threadTs: string;
  recipientUserId: string;   // event.user
  recipientTeamId: string;   // event.team
}
```

Keep the throttle / dedup / max-failures logic identical to d0.

---

### 3. `lib/generate-response.ts` ← modify

Add an optional `thinkingManager` parameter:

```ts
export const generateResponse = async (
  messages: ModelMessage[],
  updateStatus?: (status: string) => void,
  slackThreadUrl?: string,
  channelHistory?: string,
  enrichedContext?: string,
  accountInfo?: any,
  thinkingManager?: ThinkingStreamManager,   // ← new
)
```

Inside each tool's `execute` callback, call the manager hooks:

**`searchChannelHistory`**
```ts
thinkingManager?.addToolStart("searchChannelHistory", { searchQuery });
// ... existing search logic ...
thinkingManager?.completeCurrentTool(results);
```

**`createTicket`**
```ts
thinkingManager?.addToolStart("createTicket", { issueTitle });
// ... existing ticket creation logic ...
thinkingManager?.completeCurrentTool({ success: true });
// or on error:
thinkingManager?.errorCurrentTool(errorMessage);
```

---

### 4. `lib/handle-messages.ts` ← modify (`handleNewAssistantMessage`)

Instantiate the manager and wrap the in-scope response generation:

```ts
import { ThinkingStreamManager } from "./thinking-stream-manager";

// Inside handleNewAssistantMessage, after classification is confirmed in-scope:
const thinkingManager = new ThinkingStreamManager({
  client,
  channel,
  threadTs: thread_ts,
  recipientUserId: event.user,
  recipientTeamId: event.team,
});

await thinkingManager.start();
try {
  ({ text: result } = await generateResponse(
    messages, updateStatus, slackThreadUrl, channelHistory,
    undefined, undefined, thinkingManager
  ));
  await thinkingManager.stop();
} catch (error) {
  await thinkingManager.stopWithError(error);
  throw error;
}
```

Remove the `updateStatus("is working on your request...")` call since the stream replaces it.

---

### 5. `lib/handle-app-mention.ts` ← modify (`handleNewAppMention`)

Same as above. The stream shows in the thread while the ephemeral message is the final result.
The stream's `stopStream` call finalizes the task list before `postFinalEphemeral` posts the answer.

```ts
const thinkingManager = new ThinkingStreamManager({
  client,
  channel,
  threadTs: thread_ts ?? event.ts,
  recipientUserId: event.user,
  recipientTeamId: event.team,
});

await thinkingManager.start();
try {
  ({ text: result, ticketUrl } = await generateResponse(
    messages, updateMessage, slackThreadUrl, channelHistory,
    enrichedContext, accountInfo, thinkingManager
  ));
  await thinkingManager.stop();
} catch (error) {
  await thinkingManager.stopWithError(error);
  throw error;
}
```

---

## What we get `recipient_team_id` from

`event.team` is present on all Slack events. No extra API calls needed.

---

## What does NOT need to change

- `classify-request.ts` — classification happens before the stream starts; no stream needed
- `generate-routing-response.ts` — instant static response; no stream needed
- `api/events.ts` — no changes
- `tsconfig.json`, `package.json` — `@slack/web-api` already installed, no new deps

---

## Constraints / gotchas

- The stream message **must** be a thread reply (`thread_ts` required) — both handlers already
  have `thread_ts` available
- `recipient_team_id` is mandatory when posting to a channel — covered by `event.team`
- `chat.startStream` requires `chat:write` scope — already granted
- If `start()` fails (e.g. Slack API error), the manager sets `disabled = true` internally and
  all subsequent calls become no-ops, so generation still works without streaming
- Vercel serverless has a 10-second sync timeout but uses `waitUntil()` for async work — the
  stream is entirely within the async block so this is fine

---

## Implementation order

1. `lib/thinking-stream.ts` (copy from d0, no changes)
2. `lib/thinking-stream-manager.ts` (adapted for dshelp-agent tools)
3. `lib/generate-response.ts` (add `thinkingManager` param + hooks in tool callbacks)
4. `lib/handle-messages.ts` (instantiate + start/stop around generation)
5. `lib/handle-app-mention.ts` (same)
