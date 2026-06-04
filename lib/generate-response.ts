import { ModelMessage } from "ai";
import { loadToolApproval } from "./policy/load";
import { runAgent, type ToolOutcome } from "./run-agent";
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

  const { text, outcomes } = await runAgent({
    messages,
    runtimeContext,
    toolApproval,
    bashTools,
    updateStatus,
  });

  // One consistent footer at the bottom listing every tool involved and its
  // outcome (e.g. "🔧 getWeather" / "🔧 getWeather (blocked by policy)").
  const footer =
    outcomes.length > 0
      ? `\n\n_🔧 ${[...new Set(outcomes.map(toolLabel))].join(", ")}_`
      : "";

  // Convert markdown to Slack mrkdwn format.
  const answer = text
    .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
    .replace(/\*\*/g, "*");

  // If a tool was denied/errored and nothing ran successfully, show the policy
  // reason verbatim rather than the model's (possibly confabulated) text.
  const problems = outcomes.filter((o) => o.status !== "used");
  const anySuccess = outcomes.some((o) => o.status === "used");
  if (problems.length > 0 && !anySuccess) {
    const body = problems
      .map((o) => o.reason ?? `${o.toolName} ${o.status}`)
      .join("\n");
    return body + footer;
  }

  return answer + footer;
};

function toolLabel(outcome: ToolOutcome): string {
  if (outcome.status === "used") return outcome.toolName;
  const suffix = outcome.status === "denied" ? "blocked by policy" : "failed";
  return `${outcome.toolName} (${suffix})`;
}
