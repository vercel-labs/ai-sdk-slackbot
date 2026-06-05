# Policy for the Slack bot's tool surface.
#
# Compiled to WASM with:
#   opa build -t wasm -e 'agent/call/decision' -o policies/bundle.tar.gz policies/decision.rego
#   tar -xzf policies/bundle.tar.gz -C policies/ /policy.wasm
#
# Input shape (set by the AI SDK's @ai-sdk/policy-opa adapter):
#   {
#     "tool":    { "name": <string> },
#     "args":    <tool input>,
#     "messages":[...],
#     "runtimeContext": { "channelId", "userId" },
#     # Only for the bash tool, added by toInput in lib/policy/load.ts:
#     "bash":    { "program": <string>, "argv": [<string>], "suspicious": <bool> }
#   }
#
# Decision shape (consumed by normalizeOpaDecision):
#   { "decision": "allow" | "deny" | "requires-approval" | "not-applicable",
#     "reason":   <optional string surfaced to the model/user> }

package agent.call

import rego.v1

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

allowed_cities := {"san francisco", "austin", "new york", "london", "berlin"}

allowed_domain := "vercel.com"

# Display version of the city list, used in deny reasons.
allowed_cities_display := "San Francisco, Austin, New York, London, Berlin"

# Slack channel ID where `throwDice` is permitted. Matched on the immutable
# channel ID (not the name) so it needs no extra Slack scope or lookup. Replace
# this with your channel's ID: right-click the channel in Slack → "View channel
# details" → the ID is at the bottom (starts with C for public, G for private).
allowed_dice_channel := "C0B6YBUHMME"

# Bash commands the bot may run. Add or remove a command here to change what's
# allowed — everything not listed (rm, curl, git, mkdir, ...) is denied.
#
# Do NOT add commands that can launch or sequence other programs (env, find,
# xargs, sh, bash, awk, sed, python, ...): the policy gates on the program name
# (argv[0]) only, so a launcher would run an unlisted program past the gate.
allowed_bash_commands := {
	"echo", "ls", "cat", "pwd", "date", "whoami", "head", "tail", "wc",
	"grep", "sort", "uniq", "tree", "printf", "seq",
	"stat", "which", "basename", "dirname",
}

# ---------------------------------------------------------------------------
# Top-level entrypoint. Returns one decision object.
# Default-deny: any tool without an explicit rule below is denied, so adding a
# new tool to the bot requires consciously allowing it here.
# ---------------------------------------------------------------------------

default decision := {"decision": "deny", "reason": "This tool is not permitted by policy."}

decision := get_weather_decision if input.tool.name == "getWeather"

decision := search_web_decision if input.tool.name == "searchWeb"

decision := throw_dice_decision if input.tool.name == "throwDice"

decision := bash_decision if input.tool.name == "bash"

decision := read_file_decision if input.tool.name == "readFile"

decision := write_file_decision if input.tool.name == "writeFile"

# ---------------------------------------------------------------------------
# Rule 1 — getWeather: city must be in the allowlist (case-insensitive,
# trimmed). Personalized deny reason includes the offending city.
# ---------------------------------------------------------------------------

get_weather_decision := {"decision": "allow"} if {
	is_string(input.args.city)
	lower(trim_space(input.args.city)) in allowed_cities
} else := {
	"decision": "deny",
	"reason": sprintf(
		"Sorry, I can't get weather for %s — not allowed per policy. Allowed cities: %s.",
		[city_label, allowed_cities_display],
	),
}

city_label := input.args.city if is_string(input.args.city)

city_label := "this location" if not is_string(input.args.city)

# ---------------------------------------------------------------------------
# Rule 2 — searchWeb: Exa search must be scoped to vercel.com. We can't
# rewrite args from a Rego rule (the SDK has no rewrite decision), so a
# missing or wrong domain is a hard deny with a fixed reason.
#
# NOTE: this only scopes the *search*. It can't stop the model from answering
# from its own training knowledge if the vercel.com search returns nothing —
# the policy gates tool calls, not the model's free text. See README "What the
# policy does and does not guarantee".
# ---------------------------------------------------------------------------

search_web_decision := {"decision": "allow"} if {
	is_string(input.args.specificDomain)
	lower(trim_space(input.args.specificDomain)) == allowed_domain
} else := {
	"decision": "deny",
	"reason": "I can only search vercel.com per policy.",
}

# ---------------------------------------------------------------------------
# Rule 3 — throwDice: only permitted in the configured channel, matched on the
# immutable `runtimeContext.channelId` set by the Slack handler per request
# (see lib/policy/runtime-context.ts).
# ---------------------------------------------------------------------------

throw_dice_decision := {"decision": "allow"} if {
	input.runtimeContext.channelId == allowed_dice_channel
} else := {
	"decision": "deny",
	"reason": "Sorry, throwDice can only be used in the designated channel.",
}

# ---------------------------------------------------------------------------
# Rule 4 — bash: allow only a single allowlisted command operating on relative,
# non-traversing paths. `suspicious` (chaining/piping/redirection/env-prefix)
# is flagged by toInput. The deny reason is selected by `bash_deny_reason`.
# ---------------------------------------------------------------------------

bash_decision := {"decision": "allow"} if {
	not input.bash.suspicious
	input.bash.program in allowed_bash_commands
	not bash_arg_escapes_workspace
} else := {"decision": "deny", "reason": bash_deny_reason}

bash_deny_reason := "Only a single, simple command is allowed (no pipes, redirects, chaining, or variable assignments)." if input.bash.suspicious

bash_deny_reason := sprintf(
	"`%s` is not an allowed command. Allowed: %s.",
	[input.bash.program, concat(", ", sort(allowed_bash_commands))],
) if {
	not input.bash.suspicious
	not input.bash.program in allowed_bash_commands
}

bash_deny_reason := "Commands may only reference relative paths within the workspace." if {
	not input.bash.suspicious
	input.bash.program in allowed_bash_commands
	bash_arg_escapes_workspace
}

bash_arg_escapes_workspace if {
	some arg in input.bash.argv
	path_escapes_workspace(arg)
}

# Shared path-safety check: absolute paths and `..` traversal escape the
# workspace. Used by both the bash rule above and the readFile rule below.
path_escapes_workspace(p) if startswith(p, "/")

path_escapes_workspace(p) if contains(p, "..")

# ---------------------------------------------------------------------------
# Rule 5 — file access: the bot is read-only. writeFile is always denied;
# readFile is allowed only for relative, non-traversing paths.
# ---------------------------------------------------------------------------

write_file_decision := {
	"decision": "deny",
	"reason": "This bot is read-only; writing files is not permitted.",
}

read_file_decision := {"decision": "allow"} if {
	is_string(input.args.path)
	not path_escapes_workspace(input.args.path)
} else := {
	"decision": "deny",
	"reason": "Only relative paths within the workspace can be read.",
}
