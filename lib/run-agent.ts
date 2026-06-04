// @ts-nocheck — ai@7-beta's generic inference over tool({ inputSchema, execute })
// plus generateText's options type OOMs tsc. This module isolates that single
// call so the rest of generate-response.ts stays type-checked. The exported
// signature below is the typed boundary callers rely on. Remove the directive
// when ai@7 stabilizes its type inference.
import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { model } from "./model";
import { exa } from "./utils";

/** A single tool-result as the failure logic consumes it. */
export interface AgentToolResult {
  toolName: string;
  output?: { type?: string; reason?: string; value?: unknown };
}

export interface AgentResult {
  text: string;
  toolResults: AgentToolResult[];
}

export async function runAgent(opts: {
  messages: ModelMessage[];
  runtimeContext: unknown;
  toolApproval: unknown;
  bashTools: Record<string, unknown>;
  updateStatus?: (status: string) => void;
}): Promise<AgentResult> {
  const { messages, runtimeContext, toolApproval, bashTools, updateStatus } = opts;

  const result = await generateText({
    model,
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

  // Failed/denied tool calls only appear in the message stream, not in the
  // typed step.toolResults accessor — collect them here for the caller.
  const toolResults = result.response.messages.flatMap((m) =>
    Array.isArray(m.content)
      ? m.content.filter((p) => p?.type === "tool-result")
      : [],
  );

  return { text: result.text, toolResults };
}
