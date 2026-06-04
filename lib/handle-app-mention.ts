import { AppMentionEvent } from "@slack/web-api";
import { client, getThread } from "./slack-utils";
import { generateResponse } from "./generate-response";
import { runtimeContextFromEvent } from "./policy/runtime-context";

const updateStatusUtil = async (
  initialStatus: string,
  event: AppMentionEvent,
) => {
  const initialMessage = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: initialStatus,
  });

  if (!initialMessage || !initialMessage.ts)
    throw new Error("Failed to post initial message");

  const updateMessage = async (status: string) => {
    await client.chat.update({
      channel: event.channel,
      ts: initialMessage.ts as string,
      text: status,
    });
  };
  return updateMessage;
};

export async function handleNewAppMention(
  event: AppMentionEvent,
  botUserId: string,
) {
  console.log("Handling app mention");
  if (event.bot_id || event.bot_id === botUserId || event.bot_profile) {
    console.log("Skipping app mention");
    return;
  }

  const { thread_ts, channel } = event;
  // Post the status first so we hold the updater and can surface any failure
  // below (e.g. getThread hitting a missing channels:history scope) instead of
  // leaving an orphaned "is thinking..." message.
  const updateMessage = await updateStatusUtil("is thinking...", event);
  try {
    // Independent Slack reads — overlap them.
    const [runtimeContext, messages] = await Promise.all([
      runtimeContextFromEvent({ channel, user: event.user }),
      thread_ts
        ? getThread(channel, thread_ts, botUserId)
        : Promise.resolve([{ role: "user" as const, content: event.text }]),
    ]);
    const result = await generateResponse(messages, runtimeContext, updateMessage);
    await updateMessage(result);
  } catch (error) {
    console.error("Error handling app mention", error);
    await updateMessage(
      "⚠️ Something went wrong handling that — check the bot logs (a missing Slack scope is the usual cause).",
    );
  }
}
