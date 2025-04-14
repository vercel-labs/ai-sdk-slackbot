import type {
	AssistantThreadStartedEvent,
	GenericMessageEvent,
} from "@slack/web-api";
import { generateResponse } from "./generate-response";
import { client, getThread, updateStatusUtil } from "./slack-utils";

export async function assistantThreadMessage(
	event: AssistantThreadStartedEvent,
) {
	const { channel_id, thread_ts } = event.assistant_thread;

	await client.chat.postMessage({
		channel: channel_id,
		thread_ts: thread_ts,
		text: "Hello, I'm an AI assistant built with the AI SDK by Vercel!",
	});

	await client.assistant.threads.setSuggestedPrompts({
		channel_id: channel_id,
		thread_ts: thread_ts,
		prompts: [
			{
				title: "Get the weather",
				message: "What is the current weather in London?",
			},
			{
				title: "Get the news",
				message: "What is the latest Premier League news from the BBC?",
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
	) {
		return;
	}

	const { thread_ts, channel } = event;
	const updateStatus = updateStatusUtil(channel, thread_ts);
	await updateStatus("is thinking...");

	const messages = await getThread(channel, thread_ts, botUserId);
	const result = await generateResponse(messages, updateStatus);

	await client.chat.postMessage({
		channel: channel,
		thread_ts: thread_ts,
		text: result,
		unfurl_links: false,
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: result,
				},
			},
		],
	});

	await updateStatus("");
}
