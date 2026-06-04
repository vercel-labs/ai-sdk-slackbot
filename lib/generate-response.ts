import { ModelMessage } from "ai";
import { loadToolApproval } from "./policy/load";
import { runAgent } from "./run-agent";
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

  // runAgent classifies the tool outcomes: `usedTools` are tools that ran
  // successfully (surfaced as a footer), `failures` are user-facing lines for
  // policy denials / tool errors. Surfacing denials verbatim guards against a
  // model confabulating a "success" after a denied call.
  const { text, usedTools, failures } = await runAgent({
    messages,
    runtimeContext,
    toolApproval,
    bashTools,
    updateStatus,
  });

  const toolNote =
    usedTools.length > 0 ? `\n\n_🔧 used: ${usedTools.join(", ")}_` : "";

  // Convert markdown to Slack mrkdwn format.
  const answer = text
    .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
    .replace(/\*\*/g, "*");

  if (failures.length > 0) {
    // If nothing ran successfully, return only the failure(s) so a confabulated
    // "success" never reaches the user. If some tool did succeed, keep the
    // answer and append the failures so a valid multi-part answer isn't
    // clobbered by one denial.
    if (usedTools.length > 0 && answer.trim().length > 0) {
      return [answer + toolNote, ...failures].join("\n\n");
    }
    return failures.join("\n");
  }

  return answer + toolNote;
};
