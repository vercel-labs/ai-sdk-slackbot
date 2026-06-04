# Slackbot policies

This directory holds the Rego policies that decide whether the bot is allowed
to run a given tool call. You can edit `decision.rego` without touching any
TypeScript — the bot loads it on each request (dev) or as a compiled WASM
bundle (prod).

## Input shape

Every tool call is evaluated as a separate decision. The `input` document
the policy sees looks like this:

```jsonc
{
  "tool":    { "name": "weather" },          // tool the model wants to run
  "args":    { "city": "San Francisco" },     // its inputSchema-typed args
  "messages":[                                // full chat history so far
    { "role": "user", "content": "..." }
  ],
  "runtimeContext": {                         // set by the bot per request
    "channelId":   "C0B6YBUHMME",             // raw Slack channel ID
    "channelName": "general",                  // resolved name (no '#'); undefined in DMs
    "userId":      "U0123ABCD"
  }
}
```

The `throwDice` rule gates on `channelName` and defaults to `"general"` (every
workspace has it), so the example works out of the box. Edit `allowed_dice_channel`
in `decision.rego` to allow a different channel — use the channel **name** (the
bare name, no `#`), not the ID. Note: resolving the name requires the bot's
`channels:read` scope (and `groups:read` for private channels); without it the
bot can't see the channel name and `throwDice` is denied everywhere.

Return one of:

| decision              | effect                                                |
|-----------------------|-------------------------------------------------------|
| `allow`               | tool executes                                         |
| `deny`                | tool is blocked; `reason` shown to the model & user   |
| `requires-approval`   | bot pauses for a human (not wired up in this repo)    |
| `not-applicable`      | rule has no opinion; falls through to allow           |

## Adding a new rule

Copy this skeleton into `decision.rego`:

```rego
decision := {
    "decision": "deny",
    "reason":   "short user-facing message"
} if {
    input.tool.name == "yourToolName"
    # ...your condition here...
}
```

Pair it with an allow rule (or rely on the `not-applicable` default).

## Running tests

```sh
opa test policies/
```

Each rule should have at least one positive and one negative test in
`decision_test.rego`. Tests are pure Rego — no Node, no bot, no network.

## Modes

| `POLICY_MODE` | client                 | source of truth                 | reload    |
|---------------|------------------------|---------------------------------|-----------|
| `wasm` (default) | `wasmPolicyClient`  | `policies/policy.wasm`          | rebuild   |
| `http`        | `httpPolicyClient`     | OPA server reading `./policies` | live      |

### wasm (default — no extra process)

```sh
pnpm policy:build       # opa build -t wasm -e agent/call/decision -> policies/policy.wasm
# start the bot — POLICY_MODE doesn't need to be set
```

`pnpm build` runs `policy:build` automatically, so this is the no-config path.
After editing `decision.rego`, run `pnpm policy:build` and restart.

### http (live policy reload during iteration)

```sh
opa run --server --addr :8181 ./policies
POLICY_MODE=http pnpm dev
```

Edit `decision.rego`. The next tool call uses the new rule — no rebuild,
no restart.
