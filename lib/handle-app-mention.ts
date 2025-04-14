import { AppMentionEvent } from "@slack/web-api";
import { CoreMessage } from "ai";
import { generateResponse } from "./generate-response";
import { client, getThread } from "./slack-utils";

const updateStatusUtil = async (
	initialStatus: string,
	event: AppMentionEvent,
) => {
	const initialMessage = await client.chat.postMessage({
		channel: event.channel,
		thread_ts: event.thread_ts ?? event.ts,
		text: initialStatus,
	});

	if (!initialMessage || !initialMessage.ts) {
		throw new Error("Failed to post initial message");
	}

	return async (status: string) => {
		await client.chat.update({
			channel: event.channel,
			ts: initialMessage.ts as string,
			text: status,
		});
	};
};

export async function handleNewAppMention(
	event: AppMentionEvent,
	botUserId: string,
) {
	if (event.bot_id || event.bot_id === botUserId || event.bot_profile) {
		return;
	}

	const { thread_ts, channel } = event;
	const updateMessage = await updateStatusUtil("処理中...", event);
	let result: string = "";

	try {
		const messages = thread_ts
			? await getThread(channel, thread_ts, botUserId)
			: ([{ role: "user", content: event.text }] as CoreMessage[]);
		result = await generateResponse(messages, updateMessage);
	} catch (error) {
		console.error("Error generating response:", error);
		await updateMessage(
			`エラーが発生しました: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	try {
		await updateMessage(result);
	} catch (error) {
		console.error("Error updating message:", error);
	}
}
