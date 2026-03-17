/**
 * Slack Thinking Stream API Helpers
 *
 * Implements the Slack chunked streaming format for text and thinking steps.
 * Uses chat.startStream, chat.appendStream, and chat.stopStream APIs.
 */

import type { WebClient } from "@slack/web-api";

type SlackBlock = Record<string, unknown>;

export type TaskDisplayMode = "plan" | "timeline";

export type TaskStatus = "pending" | "in_progress" | "complete" | "error";

export type TaskUpdateChunk = {
  type: "task_update";
  id: string;
  title: string;
  status: TaskStatus;
  details?: string;
  output?: string;
};

type MarkdownTextChunk = {
  type: "markdown_text";
  text: string;
};

export type ThinkingChunk = TaskUpdateChunk | MarkdownTextChunk;

export type StartStreamBody = {
  channel: string;
  thread_ts: string;
  recipient_user_id: string;
  recipient_team_id: string;
  chunks?: ThinkingChunk[];
  task_display_mode?: TaskDisplayMode;
};

export type AppendStreamBody = {
  channel: string;
  ts: string;
  chunks: ThinkingChunk[];
  markdown_text?: string;
};

export type StopStreamBody = {
  channel: string;
  ts: string;
  chunks?: ThinkingChunk[];
  blocks?: SlackBlock[];
  markdown_text?: string;
};

/**
 * Start a new thinking stream message.
 * Returns the timestamp (ts) to use for subsequent append/stop calls.
 */
export async function startStream(
  client: WebClient,
  body: StartStreamBody,
): Promise<string> {
  const response = await client.apiCall("chat.startStream", body);

  if (!response.ok || response.error) {
    throw new Error(`Failed to start task streaming: ${response.error}`);
  }

  // @ts-expect-error - these types aren't available yet because of the beta
  return response.ts;
}

/**
 * Append chunks to an existing thinking stream.
 */
export async function appendStream(
  client: WebClient,
  body: AppendStreamBody,
): Promise<void> {
  const response = await client.apiCall("chat.appendStream", body);

  if (!response.ok || response.error) {
    throw new Error(`Failed to append to stream: ${response.error}`);
  }
}

/**
 * Stop a thinking stream and finalize the message.
 * Any incomplete tasks will automatically be marked as error.
 */
export async function stopStream(
  client: WebClient,
  body: StopStreamBody,
): Promise<void> {
  const response = await client.apiCall("chat.stopStream", body);

  if (!response.ok || response.error) {
    throw new Error(`Failed to stop stream: ${response.error}`);
  }
}

/**
 * Helper to create a task update chunk
 */
export function createTaskUpdate(
  id: string,
  title: string,
  status: TaskStatus,
  options?: { details?: string; output?: string },
): TaskUpdateChunk {
  return {
    type: "task_update",
    id,
    title,
    status,
    ...options,
  };
}
