// Slack event types
type AppMentionEvent = any;
import { client, getThread, getChannelHistory, findRelevantThreads } from "./slack-utils";
import { generateResponse } from "./generate-response";
import { classifyRequest } from "./classify-request";
import { generateRoutingResponse } from "./generate-routing-response";
import { lookupAccountBySlackChannel, lookupAccountByChannelName } from "./salesforce-lookup";
import { ThinkingStreamManager } from "./thinking-stream-manager";

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
  const threadTs = thread_ts ?? event.ts;

  const thinkingManager = new ThinkingStreamManager({
    client,
    channel,
    threadTs,
    recipientUserId: event.user,
    recipientTeamId: event.team,
  });
  await thinkingManager.start();

  const postFinalEphemeral = async (text: string, ticketUrl?: string) => {
    await thinkingManager.stop();
    if (ticketUrl) {
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: "Thanks for reaching out to DSE Anywhere. An expert will respond to you shortly.",
      });
    }
    await client.chat.postEphemeral({
      channel: event.channel,
      thread_ts: threadTs,
      user: event.user,
      text: ticketUrl ? `<${ticketUrl}|View ticket>` : (text || "⚠️ Error: Unable to generate response. Please try again."),
    });
  };

  try {
    console.log('[handleNewAppMention] Processing mention from user:', event.user);
    console.log('[handleNewAppMention] Event text:', event.text);
    console.log('[handleNewAppMention] Channel:', channel, 'Thread:', thread_ts);
    console.log('[handleNewAppMention] Event:', JSON.stringify(event, null, 2));
    // Detect forwarded messages
    const forwardedAttachment = event.attachments?.find(
      (a: any) => a.is_msg_unfurl === true
    );
    const isForwardedMessage = !!forwardedAttachment;
    const originalChannelId = forwardedAttachment?.channel_id;

    // Look up Salesforce account info using the relevant channel
    // For forwarded messages: use the originating customer channel
    // For direct mentions: use the current channel
    const lookupChannelId = isForwardedMessage ? originalChannelId : channel;
    let accountInfo = null;
    if (lookupChannelId) {
      if (isForwardedMessage) {
        console.log('[handleNewAppMention] Forwarded message from channel:', originalChannelId, 'author:', forwardedAttachment.author_name);
      }

      // Primary: exact channel ID match
      accountInfo = await lookupAccountBySlackChannel(lookupChannelId);
      if (accountInfo) {
        console.log('[handleNewAppMention] Found Salesforce account via channel ID:', {
          name: accountInfo.NAME,
          teamId: accountInfo.TEAM_ID_C,
          segment: accountInfo.SUBSCRIPTION_PLAN_C
        });
      } else {
        // Fallback: look up by channel name
        console.log('[handleNewAppMention] No account via channel ID, trying name fallback');
        try {
          const channelInfoResult = await client.conversations.info({ channel: lookupChannelId });
          const channelName = channelInfoResult.channel?.name;
          if (channelName) {
            accountInfo = await lookupAccountByChannelName(channelName);
            if (accountInfo) {
              console.log('[handleNewAppMention] Found account via name fallback:', {
                name: accountInfo.NAME,
                teamId: accountInfo.TEAM_ID_C,
                segment: accountInfo.SUBSCRIPTION_PLAN_C
              });
            }
          }
        } catch (slackError) {
          // Non-fatal: bot may not have access to external workspace channels
          console.error('[handleNewAppMention] Error fetching channel info:', slackError);
        }
      }
    }

    let messages;
    if (isForwardedMessage) {
      // Use the forwarded message content as the user message
      const forwardedText = forwardedAttachment.text || forwardedAttachment.fallback || '';
      const authorInfo = forwardedAttachment.author_name
        ? `[Forwarded from ${forwardedAttachment.author_name}]: `
        : '';
      messages = [{ role: "user" as const, content: `${authorInfo}${forwardedText}` }];
    } else if (thread_ts) {
      console.log('[handleNewAppMention] Fetching thread messages');
      messages = await getThread(channel, thread_ts, botUserId);
    } else {
      console.log('[handleNewAppMention] No thread, using direct message');
      // Remove bot mention from the message
      const cleanedText = event.text.replace(`<@${botUserId}>`, '').trim();
      messages = [{ role: "user" as const, content: cleanedText }];
    }
    console.log('[handleNewAppMention] Messages count:', messages.length);

    // Retrieve channel history and relevant threads
    // Skip for forwarded messages since the bot may not be in the original channel
    let channelHistory = '';
    let enrichedContext = '';

    if (isForwardedMessage) {
      console.log('[handleNewAppMention] Skipping channel history/thread discovery for forwarded message');
    } else {
      console.log('[handleNewAppMention] Fetching channel history from:', channel);
      channelHistory = await getChannelHistory(channel, botUserId, 100);
      console.log('[handleNewAppMention] Channel history length:', channelHistory.length);

      // Find relevant threads (only if not already in a thread)
      if (!thread_ts) {
        console.log('[handleNewAppMention] Finding relevant threads in channel');
        thinkingManager.updateTitle("searching channel threads for context...");

        const threadDiscovery = await findRelevantThreads(channel, event.text, botUserId);
        console.log('[handleNewAppMention] Thread discovery summary:', threadDiscovery.summary);

        if (threadDiscovery.relevantThreads.length > 0) {
          enrichedContext = '\n\n## Relevant Thread Context:\n\n' +
            threadDiscovery.relevantThreads.map(thread => {
              return `**Thread about:** ${thread.relevanceReason}\n` +
                `**Root message:** ${thread.rootMessage}\n` +
                `**Thread replies:**\n${thread.threadMessages.join('\n')}`;
            }).join('\n\n---\n\n');

          console.log('[handleNewAppMention] Added', threadDiscovery.relevantThreads.length, 'threads to context');
        }
      } else {
        console.log('[handleNewAppMention] Already in a thread, skipping thread discovery');
      }
    }

    // Classify the request to check if it's in DS scope
    console.log('[handleNewAppMention] Starting classification');
    thinkingManager.updateTitle("analyzing your request...");
    const classification = await classifyRequest(messages, enrichedContext, accountInfo);

    console.log(`[handleNewAppMention] Classification result:`, JSON.stringify(classification));

    let result: string;
    let ticketUrl: string | undefined;

    if (!classification.isInScope) {
      console.log('[handleNewAppMention] Request is OUT OF SCOPE');
      // Out of scope - provide routing guidance
      result = generateRoutingResponse({
        category: classification.category,
        suggestedTeam: classification.suggestedTeam,
        reasoning: classification.reasoning,
      });
    } else {
      console.log('[handleNewAppMention] Request is IN SCOPE - generating response');

      // Build Slack thread URL — link to original message for forwarded messages
      const slackThreadUrl = isForwardedMessage && forwardedAttachment.from_url
        ? forwardedAttachment.from_url
        : `https://slack.com/app_redirect?channel=${channel}&thread_ts=${thread_ts ?? event.ts}`;

      try {
        console.log('[handleNewAppMention] Calling generateResponse');
        ({ text: result, ticketUrl } = await generateResponse(
          messages, undefined, slackThreadUrl, channelHistory, enrichedContext, accountInfo, thinkingManager, event.user,
        ));
        console.log('[handleNewAppMention] generateResponse returned, result length:', result?.length || 0);
      } catch (error) {
        await thinkingManager.stopWithError(error);
        throw error;
      }
    }

    console.log('[handleNewAppMention] About to post final result');
    await postFinalEphemeral(result, ticketUrl);
    console.log('[handleNewAppMention] Successfully completed');
  } catch (error) {
    console.error("Error handling app mention:", error);
    await postFinalEphemeral(
      "⚠️ An error occurred while processing your request. Please check the logs or try again."
    );
  }
}
