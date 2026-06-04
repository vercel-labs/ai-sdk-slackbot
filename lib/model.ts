import { openai } from "@ai-sdk/openai";
import { ollama } from "ai-sdk-ollama";
import type { LanguageModel } from "ai";

/**
 * The chat model the bot uses.
 *
 * Defaults to OpenAI (`gpt-4o`) so the Vercel deploy template works with only
 * an `OPENAI_API_KEY`. Set `MODEL_PROVIDER=ollama` to run a local model via
 * Ollama instead — offline and free, but local-dev only: a deployed function
 * can't reach `localhost:11434`. See the README for the Ollama setup.
 */
export const model: LanguageModel =
  process.env.MODEL_PROVIDER === "ollama"
    ? ollama(process.env.OLLAMA_MODEL ?? "llama3.1")
    : openai(process.env.OPENAI_MODEL ?? "gpt-4o");
