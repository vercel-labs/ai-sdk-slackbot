// Slack event types
type SlackEvent = any;
import {
  assistantThreadMessage,
  handleNewAssistantMessage,
} from "../lib/handle-messages";
import { waitUntil } from "@vercel/functions";
import { handleNewAppMention } from "../lib/handle-app-mention";
import { verifyRequest, getBotId } from "../lib/slack-utils";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);
  const requestType = payload.type as "url_verification" | "event_callback";

  // See https://api.slack.com/events/url_verification
  if (requestType === "url_verification") {
    return new Response(payload.challenge, { status: 200 });
  }

  // Forward to preview environment if message contains --preview flag
  const PREVIEW_URL = process.env.PREVIEW_URL;
  if (PREVIEW_URL && payload.event?.text?.includes("--preview")) {
    try {
      await fetch(`${PREVIEW_URL}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Slack-Request-Timestamp": request.headers.get("X-Slack-Request-Timestamp") || "",
          "X-Slack-Signature": request.headers.get("X-Slack-Signature") || "",
        },
        body: rawBody,
      });
      return new Response("Forwarded to preview", { status: 200 });
    } catch (error) {
      console.error("Failed to forward to preview:", error);
      return new Response("Preview forwarding failed", { status: 502 });
    }
  }

  const verifyResponse = await verifyRequest({ requestType, request, rawBody });
  if (verifyResponse) {
    return verifyResponse;
  }

  try {
    const botUserId = await getBotId();

    const event = payload.event as SlackEvent;

    if (event.type === "app_mention") {
      waitUntil(handleNewAppMention(event, botUserId));
    }

    if (event.type === "assistant_thread_started") {
      waitUntil(assistantThreadMessage(event));
    }

    if (
      event.type === "message" &&
      !event.subtype &&
      event.channel_type === "im" &&
      !event.bot_id &&
      !event.bot_profile &&
      event.bot_id !== botUserId
    ) {
      waitUntil(handleNewAssistantMessage(event, botUserId));
    }

    return new Response("Success!", { status: 200 });
  } catch (error) {
    console.error("Error generating response", error);
    return new Response("Error generating response", { status: 500 });
  }
}
