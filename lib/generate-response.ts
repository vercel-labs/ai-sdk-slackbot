// @ts-nocheck — ai@7-beta infers generateText's TOOLS generic across the
// `tools` object (zod schemas) + `toolApproval`, which OOMs tsc. A narrower
// suppression (aliasing generateText, casting the call) does NOT help — the
// cost is the whole-tools-object inference, not one expression — so the whole
// file opts out. `build` runs `tsc --noEmit` on the rest of the repo.
import { ollama } from "ai-sdk-ollama";
import { generateText, ModelMessage, stepCountIs, tool } from "ai";
import { z } from "zod";
import { exa } from "./utils";
import { loadToolApproval } from "./policy/load";
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

  const result = await generateText({
    model: ollama("llama3.1"),
    system: `You are a Slack bot assistant Keep your responses concise and to the point.
    - Do not tag users.
    - Current date is: ${new Date().toISOString().split("T")[0]}
    - Make sure to ALWAYS include sources in your final response if you use web search. Put sources inline if possible.
    - If a tool call is denied by policy, surface the reason text to the user verbatim.`,
    messages,
    stopWhen: stepCountIs(10),
    runtimeContext,
    toolApproval,
    tools: {
      getWeather: tool({
        description:
          "Get the current weather for a city. Only requires the city name — coordinates are looked up server-side.",
        inputSchema: z.object({
          city: z.string().describe("City name only, e.g. 'San Francisco'."),
        }),
        execute: async ({ city }) => {
          updateStatus?.(`is getting weather for ${city}...`);

          // Policy already restricts which cities reach here; we only need to
          // geocode for the allowlist.
          const geo = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`,
          ).then((r) => r.json());
          const hit = geo?.results?.[0];
          if (!hit) {
            return { error: `Could not geocode "${city}".`, city };
          }

          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weathercode,relativehumidity_2m&timezone=auto`,
          );

          const weatherData = await response.json();
          return {
            temperature: weatherData.current.temperature_2m,
            weatherCode: weatherData.current.weathercode,
            humidity: weatherData.current.relativehumidity_2m,
            city,
          };
        },
      }),
      searchWeb: tool({
        description: "Use this to search the web for information",
        inputSchema: z.object({
          query: z.string(),
          specificDomain: z
            .string()
            .nullable()
            .describe(
              "a domain to search if the user specifies e.g. bbc.com. Should be only the domain name without the protocol",
            ),
        }),
        execute: async ({ query, specificDomain }) => {
          updateStatus?.(`is searching the web for ${query}...`);
          const { results } = await exa.searchAndContents(query, {
            livecrawl: "always",
            numResults: 3,
            includeDomains: specificDomain ? [specificDomain] : undefined,
          });

          return {
            results: results.map((result) => ({
              title: result.title,
              url: result.url,
              snippet: result.text.slice(0, 1000),
            })),
          };
        },
      }),
      throwDice: tool({
        description: "Roll a six-sided die and return a number between 1 and 6",
        inputSchema: z.object({}),
        execute: async () => {
          updateStatus?.("is rolling a die...");
          return { roll: Math.floor(Math.random() * 6) + 1 };
        },
      }),
      ...bashTools,
    },
  });

  // llama3.1 confabulates after tool failures (invents a successful response
  // when the tool was denied or rejected). Collect every tool-result so we can
  // surface real failures instead of the model's hallucinated text.
  const toolResults = result.response.messages.flatMap((m) =>
    Array.isArray(m.content)
      ? (m.content as any[]).filter((p) => p?.type === "tool-result")
      : [],
  );
  // failureLineFor is the single source of truth for "is this a failure": it
  // returns one line for a denied/failed result and nothing for a success, so
  // failures.length is exactly the count of failed tool calls.
  const failures = toolResults.flatMap(failureLineFor);

  // Convert markdown to Slack mrkdwn format.
  const answer = result.text
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

function failureLineFor(part: any): string[] {
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
