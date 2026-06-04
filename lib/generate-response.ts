import { ModelMessage } from "ai";
import { loadToolApproval } from "./policy/load";
import { runAgent, type AgentToolResult } from "./run-agent";
import { SlackRuntimeContext } from "./policy/runtime-context";

// bash/readFile/writeFile run in an in-memory just-bash sandbox (offline,
// no host access). Seeded with a couple of files so ls/cat have content.
// Constructed once and reused. bash-tool is ESM-only, so it's pulled via a
// dynamic import() (works from both CommonJS output and the Vercel bundler).
let bashToolsPromise: Promise<Record<string, unknown>> | undefined;
function getBashTools(): Promise<Record<string, unknown>> {
  if (!bashToolsPromise) {
    bashToolsPromise = import("bash-tool")
      .then(({ createBashTool }) =>
        createBashTool({
          files: {
            "README.md": "# Demo workspace\n\nThis is a sandboxed bash demo for the policy bot.\n",
            "notes.txt": "line one\nline two\nline three\n",
          },
        }),
      )
      .then((r) => r.tools as Record<string, unknown>);
    // Don't cache a rejected import: reset so the next request retries instead
    // of disabling the bot for the process lifetime.
    bashToolsPromise.catch(() => {
      bashToolsPromise = undefined;
    });
  }
  return bashToolsPromise;
}

export const generateResponse = async (
  messages: ModelMessage[],
  runtimeContext: SlackRuntimeContext,
  updateStatus?: (status: string) => void,
): Promise<string> => {
  // Independent cold-start work; overlap it.
  const [toolApproval, bashTools] = await Promise.all([
    loadToolApproval(),
    getBashTools(),
  ]);

  const { text, toolResults } = await runAgent({
    messages,
    runtimeContext,
    toolApproval,
    bashTools,
    updateStatus,
  });

  // llama3.1 confabulates after tool failures (invents a successful response
  // when the tool was denied or rejected). failureLineFor is the single source
  // of truth for "is this a failure": it returns one line for a denied/failed
  // result and nothing for a success, so failures.length is exactly the count
  // of failed tool calls.
  const failures = toolResults.flatMap(failureLineFor);

  // Convert markdown to Slack mrkdwn format.
  const answer = text
    .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
    .replace(/\*\*/g, "*");

  if (failures.length > 0) {
    // If every tool call failed, the model has nothing real to report — return
    // only the failure(s) so a confabulated "success" never reaches the user.
    // If some call succeeded, keep the answer and append the failures so a
    // valid multi-part answer isn't clobbered by one denial.
    const anySuccess = toolResults.length > failures.length;
    if (anySuccess && answer.trim().length > 0) {
      return [answer, ...failures].join("\n\n");
    }
    return failures.join("\n");
  }

  return answer;
};

function failureLineFor(part: AgentToolResult): string[] {
  switch (part.output?.type) {
    case "execution-denied":
      return [`*${part.toolName}* was blocked by policy: ${part.output.reason ?? "no reason provided"}`];
    case "error-text":
    case "error-json": {
      const value = part.output.value ?? "unknown error";
      return [`*${part.toolName}* failed: ${typeof value === "string" ? value : JSON.stringify(value)}`];
    }
    default:
      return [];
  }
}
