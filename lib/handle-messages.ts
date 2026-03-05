// Slack event types
type AssistantThreadStartedEvent = any;
type GenericMessageEvent = any;
import { client, getThread, getChannelHistory, updateStatusUtil } from "./slack-utils";
import { generateResponse } from "./generate-response";
import { classifyRequest } from "./classify-request";
import { generateRoutingResponse } from "./generate-routing-response";
import { ThinkingStreamManager } from "./thinking-stream-manager";

export async function assistantThreadMessage(
  event: AssistantThreadStartedEvent,
) {
  const { channel_id, thread_ts } = event.assistant_thread;
  console.log(`Thread started: ${channel_id} ${thread_ts}`);
  console.log(JSON.stringify(event));

  await client.chat.postMessage({
    channel: channel_id,
    thread_ts: thread_ts,
    text: "Hello! I'm the Developer Success AI assistant. I can help with Vercel platform issues, Next.js development, AI SDK implementation, and architecture guidance. How can I assist you today?",
  });

  await client.assistant.threads.setSuggestedPrompts({
    channel_id: channel_id,
    thread_ts: thread_ts,
    prompts: [
      {
        title: "Debug a deployment issue",
        message: "I'm getting an error when deploying my Next.js app to Vercel",
      },
      {
        title: "AI SDK implementation",
        message: "How do I implement streaming with the AI SDK?",
      },
      {
        title: "Architecture guidance",
        message: "What's the best way to structure my Next.js app for production?",
      },
    ],
  });
}

export async function handleNewAssistantMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  if (
    event.bot_id ||
    event.bot_id === botUserId ||
    event.bot_profile ||
    !event.thread_ts
  )
    return;

  const { thread_ts, channel } = event;
  const updateStatus = updateStatusUtil(channel, thread_ts);
  await updateStatus("is analyzing your request...");

  const messages = await getThread(channel, thread_ts, botUserId);

  // Retrieve channel history for additional context
  const channelHistory = await getChannelHistory(channel, botUserId, 100);

  // Classify the request to check if it's in DS scope
  const classification = await classifyRequest(messages);

  console.log(`Request classification:`, JSON.stringify(classification));

  let result: string;

  if (!classification.isInScope) {
    // Out of scope - provide routing guidance as ephemeral
    result = generateRoutingResponse({
      category: classification.category,
      suggestedTeam: classification.suggestedTeam,
      reasoning: classification.reasoning,
    });
    await client.chat.postEphemeral({
      channel: channel,
      thread_ts: thread_ts,
      user: event.user,
      text: result,
    });
  } else {
    // In scope - stream handles progress; final answer is embedded via stopStream
    const slackThreadUrl = `https://slack.com/app_redirect?channel=${channel}&thread_ts=${thread_ts}`;

    const thinkingManager = new ThinkingStreamManager({
      client,
      channel,
      threadTs: thread_ts,
      recipientUserId: event.user,
      recipientTeamId: event.team,
    });

    await thinkingManager.start();
    try {
      ({ text: result } = await generateResponse(
        messages, undefined, slackThreadUrl, channelHistory,
        undefined, undefined, thinkingManager,
      ));
      await thinkingManager.stop(result);
    } catch (error) {
      await thinkingManager.stopWithError(error);
      throw error;
    }
  }

  await updateStatus("");
}
