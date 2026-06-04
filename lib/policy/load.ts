import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  opaPolicy,
  httpPolicyClient,
  wasmPolicyClient,
  type PolicyClient,
} from "@ai-sdk/policy-opa";

const POLICY_PATH = "agent/call/decision";

// Resolved relative to this file so it works regardless of process cwd.
const DEFAULT_WASM_PATH = path.resolve(__dirname, "../../policies/policy.wasm");

let cached: Promise<any> | undefined;

export function loadToolApproval(): Promise<any> {
  if (!cached) {
    cached = build();
    // Don't cache a rejection (e.g. missing policy.wasm): reset so the next
    // request retries instead of failing for the process lifetime.
    cached.catch(() => {
      cached = undefined;
    });
  }
  return cached;
}

async function build(): Promise<any> {
  // Default to WASM (in-process, no extra server). Set POLICY_MODE=http with
  // a running `opa run --server :8181` for live policy reloads during dev.
  const mode = process.env.POLICY_MODE ?? "wasm";
  let client: PolicyClient;

  if (mode === "http") {
    client = httpPolicyClient({
      url: process.env.OPA_URL ?? "http://localhost:8181",
    });
  } else {
    const wasm = await readFile(process.env.POLICY_WASM_PATH ?? DEFAULT_WASM_PATH);
    client = await wasmPolicyClient({ wasm });
  }

  return opaPolicy({ client, path: POLICY_PATH, toInput });
}

// Shell operators (and newlines) that let one call run a second command. Their
// presence means we can't reason about the call from its first token alone, so
// we flag it and let the policy reject it wholesale.
const SHELL_OPERATORS = /[;&|`\n\r]|\|\||&&|\$\(|[<>]/;
const LEADING_ENV_ASSIGNMENT = /^\s*\w+=/;

// Default OPA input shape (mirrors @ai-sdk/policy-opa's DefaultOpaInput). For
// the bash tool we additionally tokenize the command into { program, argv,
// suspicious } so the Rego allowlist can gate it without parsing strings.
function toInput(args: {
  toolCall: { toolName: string; input: unknown };
  runtimeContext: unknown;
  messages: unknown;
}) {
  const { toolCall, runtimeContext, messages } = args;
  const base = {
    tool: { name: toolCall.toolName },
    args: toolCall.input,
    messages,
    runtimeContext,
  };

  if (toolCall.toolName !== "bash") return base;

  const command = String((toolCall.input as { command?: unknown })?.command ?? "");
  const suspicious =
    SHELL_OPERATORS.test(command) || LEADING_ENV_ASSIGNMENT.test(command);
  const argv = command.trim().split(/\s+/).filter(Boolean);

  return { ...base, bash: { program: argv[0] ?? "", argv, suspicious } };
}
