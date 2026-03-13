import { WebClient } from '@slack/web-api';
import { ModelMessage, generateObject } from 'ai'
import crypto from 'crypto'
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";

// Validate and sanitize environment variables
const slackBotToken = process.env.SLACK_BOT_TOKEN?.trim();
const signingSecretRaw = process.env.SLACK_SIGNING_SECRET?.trim();

if (!slackBotToken) {
  throw new Error('SLACK_BOT_TOKEN environment variable is not set or is empty');
}

if (!signingSecretRaw) {
  throw new Error('SLACK_SIGNING_SECRET environment variable is not set or is empty');
}

// Type-safe after validation
const signingSecret: string = signingSecretRaw;

export const client = new WebClient(slackBotToken);

// Initialize gateway for LLM calls
const gatewayApiKey = process.env.AI_GATEWAY_API_KEY?.trim();
const gateway = createGateway(
  gatewayApiKey && gatewayApiKey.length > 0
    ? { apiKey: gatewayApiKey }
    : {} // Empty object allows OIDC to work on Vercel
);

// See https://api.slack.com/authentication/verifying-requests-from-slack
export async function isValidSlackRequest({
  request,
  rawBody,
}: {
  request: Request
  rawBody: string
}) {
  // console.log('Validating Slack request')
  const timestamp = request.headers.get('X-Slack-Request-Timestamp')
  const slackSignature = request.headers.get('X-Slack-Signature')
  // console.log(timestamp, slackSignature)

  if (!timestamp || !slackSignature) {
    console.log('Missing timestamp or signature')
    return false
  }

  // Prevent replay attacks on the order of 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 60 * 5) {
    console.log('Timestamp out of range')
    return false
  }

  const base = `v0:${timestamp}:${rawBody}`
  const hmac = crypto
    .createHmac('sha256', signingSecret)
    .update(base)
    .digest('hex')
  const computedSignature = `v0=${hmac}`

  // Prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(slackSignature)
  )
}

export const verifyRequest = async ({
  requestType,
  request,
  rawBody,
}: {
  requestType: string;
  request: Request;
  rawBody: string;
}) => {
  const validRequest = await isValidSlackRequest({ request, rawBody });
  if (!validRequest || requestType !== "event_callback") {
    return new Response("Invalid request", { status: 400 });
  }
};

export const updateStatusUtil = (channel: string, thread_ts: string) => {
  return async (status: string) => {
    await client.assistant.threads.setStatus({
      channel_id: channel,
      thread_ts: thread_ts,
      status: status,
    });
  };
};

export async function getThread(
  channel_id: string,
  thread_ts: string,
  botUserId: string,
): Promise<ModelMessage[]> {
  const { messages } = await client.conversations.replies({
    channel: channel_id,
    ts: thread_ts,
    limit: 50,
  });

  // Ensure we have messages

  if (!messages) throw new Error("No messages found in thread");

  const result = messages
    .map((message) => {
      const isBot = !!message.bot_id;
      if (!message.text) return null;

      // For app mentions, remove the mention prefix
      // For IM messages, keep the full text
      let content = message.text;
      if (!isBot && content.includes(`<@${botUserId}>`)) {
        content = content.replace(`<@${botUserId}> `, "");
      }

      return {
        role: isBot ? "assistant" : "user",
        content: content,
      } as ModelMessage;
    })
    .filter((msg): msg is ModelMessage => msg !== null);

  return result;
}

export async function getChannelHistory(
  channel_id: string,
  botUserId: string,
  limit: number = 100,
): Promise<string> {
  const { messages } = await client.conversations.history({
    channel: channel_id,
    limit: limit,
  });

  if (!messages) return "";

  // Format messages as contextual history
  const contextHistory = messages
    .reverse() // Show oldest first for chronological order
    .map((message) => {
      if (!message.text) return null;

      // Filter out only THIS bot's messages (keep other bots like d0)
      const isDshelpBot = message.bot_id === botUserId || message.user === botUserId;
      if (isDshelpBot) return null;

      // Skip very short messages (reactions, "ok", "thanks", etc.)
      const trimmedText = message.text.trim();
      if (trimmedText.length < 10) return null;

      let content = trimmedText;

      // Clean up Slack formatting
      // Remove bot mentions
      content = content.replace(new RegExp(`<@${botUserId}>\\s*`, 'g'), "");

      // Simplify links: <http://example.com|example.com> → http://example.com
      content = content.replace(/<(https?:\/\/[^|>]+)\|[^>]+>/g, '$1');
      content = content.replace(/<(https?:\/\/[^>]+)>/g, '$1');

      // Remove user mentions format but keep the ID for reference
      content = content.replace(/<@(U[A-Z0-9]+)>/g, '@$1');

      // Collapse multiple whitespaces/newlines
      content = content.replace(/\s+/g, ' ').trim();

      // Format with shortened timestamp
      const timestamp = message.ts
        ? new Date(parseFloat(message.ts) * 1000).toISOString().slice(0, 16).replace('T', ' ')
        : "";

      return `[${timestamp}] ${content}`;
    })
    .filter((msg): msg is string => msg !== null)
    .join("\n");

  return contextHistory;
}

export const getBotId = async () => {
  const { user_id: botUserId } = await client.auth.test();

  if (!botUserId) {
    throw new Error("botUserId is undefined");
  }
  return botUserId;
};

// Configuration for thread discovery
const MAX_RELEVANT_THREADS = parseInt(process.env.MAX_RELEVANT_THREADS || '10');
const RELEVANCE_SCORE_THRESHOLD = parseFloat(process.env.RELEVANCE_SCORE_THRESHOLD || '0.6');
const THREAD_FETCH_TIMEOUT_MS = parseInt(process.env.THREAD_FETCH_TIMEOUT_MS || '5000');

interface RelevantMessage {
  ts: string;
  reason: string;
  score: number;
}

interface RelevantThread {
  rootMessage: string;
  threadMessages: string[];
  timestamp: string;
  relevanceReason: string;
}

interface ThreadDiscoveryResult {
  relevantThreads: RelevantThread[];
  summary: string;
}

/**
 * Analyze channel messages to determine which are relevant to the user's request
 */
async function analyzeMessageRelevance(
  userPrompt: string,
  messages: any[], // Raw Slack messages
  botUserId: string
): Promise<RelevantMessage[]> {
  try {
    // Format messages for LLM analysis
    const formattedMessages = messages
      .filter(msg => {
        if (!msg.text || !msg.ts) return false;
        // Filter out bot's own messages
        const isDshelpBot = msg.bot_id === botUserId || msg.user === botUserId;
        return !isDshelpBot;
      })
      .map((msg, index) => {
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString().slice(0, 16).replace('T', ' ');
        const preview = msg.text.substring(0, 200);
        return `${index + 1}. [${timestamp}] (ts: ${msg.ts}) ${preview}`;
      })
      .join('\n');

    if (!formattedMessages) {
      console.log('[analyzeMessageRelevance] No messages to analyze');
      return [];
    }

    console.log('[analyzeMessageRelevance] Analyzing relevance for prompt:', userPrompt.substring(0, 100));
    console.log('[analyzeMessageRelevance] Analyzing', messages.length, 'messages');

    const { object } = await generateObject({
      model: gateway("openai/gpt-4o-mini"), // Use cheaper/faster model
      schema: z.object({
        relevantMessages: z.array(z.object({
          ts: z.string().describe("Message timestamp"),
          reason: z.string().describe("Why this message is relevant"),
          score: z.number().min(0).max(1).describe("Relevance score from 0-1")
        }))
      }),
      system: `You are analyzing a Slack channel to find messages that are relevant to a user's request.

Your task is to identify which messages might contain important context, such as:
- Team IDs (format: team_XXXXXXXXXXXXXXXXXXXXXXXX)
- Project IDs (format: prj_XXXXXXXXXXXXXXXXXXXXXXXX)
- Customer names or company names
- Technical issues being discussed
- Related discussions about the same topic

Only return messages with a relevance score >= ${RELEVANCE_SCORE_THRESHOLD}.
Return at most ${MAX_RELEVANT_THREADS} messages, prioritized by relevance.`,
      prompt: `User request: "${userPrompt}"

Recent channel messages:
${formattedMessages}

Return the timestamps (ts) of messages that are relevant to this request, along with a brief reason and relevance score (0-1).`
    });

    const relevantMessages = object.relevantMessages.filter(msg => msg.score >= RELEVANCE_SCORE_THRESHOLD);
    console.log('[analyzeMessageRelevance] Found', relevantMessages.length, 'relevant messages');

    return relevantMessages;

  } catch (error) {
    console.error('[analyzeMessageRelevance] Error analyzing message relevance:', error);
    // Return empty array on error - fall back to no thread discovery
    return [];
  }
}

/**
 * Find and fetch relevant threads based on the user's request
 */
export async function findRelevantThreads(
  channel_id: string,
  userPrompt: string,
  botUserId: string
): Promise<ThreadDiscoveryResult> {
  try {
    console.log('[findRelevantThreads] Starting thread discovery');
    console.log('[findRelevantThreads] User prompt:', userPrompt.substring(0, 100));

    // Fetch raw channel messages (need timestamps and thread_ts)
    const { messages } = await client.conversations.history({
      channel: channel_id,
      limit: 100,
    });

    if (!messages || messages.length === 0) {
      console.log('[findRelevantThreads] No messages in channel history');
      return { relevantThreads: [], summary: 'No channel history available' };
    }

    console.log('[findRelevantThreads] Retrieved', messages.length, 'channel messages');

    // Analyze which messages are relevant using LLM
    const relevantMessages = await analyzeMessageRelevance(userPrompt, messages, botUserId);

    if (relevantMessages.length === 0) {
      console.log('[findRelevantThreads] No relevant messages found');
      return { relevantThreads: [], summary: 'No relevant threads found in channel history' };
    }

    // Fetch threads for relevant messages (with timeout protection)
    const threadPromises = relevantMessages.slice(0, MAX_RELEVANT_THREADS).map(async (relevantMsg) => {
      try {
        // Find the original message
        const originalMessage = messages.find(m => m.ts === relevantMsg.ts);
        if (!originalMessage || !originalMessage.text) {
          return null;
        }

        // Check if message has a thread
        const replyCount = originalMessage.reply_count || 0;
        if (replyCount === 0) {
          console.log(`[findRelevantThreads] Message ${relevantMsg.ts} has no replies, skipping`);
          return null;
        }

        console.log(`[findRelevantThreads] Fetching thread for message ${relevantMsg.ts} (${replyCount} replies)`);

        // Fetch thread replies
        const { messages: threadMessages } = await client.conversations.replies({
          channel: channel_id,
          ts: relevantMsg.ts,
          limit: 50,
        });

        if (!threadMessages || threadMessages.length <= 1) {
          return null;
        }

        // Format thread messages
        const formattedThread = threadMessages
          .slice(1) // Skip root message (first item)
          .filter(msg => msg.text && msg.text.trim().length > 0)
          .map(msg => {
            const timestamp = msg.ts
              ? new Date(parseFloat(msg.ts) * 1000).toISOString().slice(0, 16).replace('T', ' ')
              : '';
            const author = msg.bot_id ? 'Bot' : 'User';
            return `  [${timestamp}] ${author}: ${msg.text}`;
          });

        return {
          rootMessage: originalMessage.text,
          threadMessages: formattedThread,
          timestamp: relevantMsg.ts,
          relevanceReason: relevantMsg.reason
        };

      } catch (error) {
        console.error(`[findRelevantThreads] Error fetching thread ${relevantMsg.ts}:`, error);
        return null;
      }
    });

    // Wait for all threads with timeout
    const timeoutPromise = new Promise<(RelevantThread | null)[]>((resolve) => {
      setTimeout(() => resolve(Array(relevantMessages.length).fill(null)), THREAD_FETCH_TIMEOUT_MS);
    });

    const threadsOrTimeout = await Promise.race([
      Promise.all(threadPromises),
      timeoutPromise
    ]);

    const relevantThreads: RelevantThread[] = threadsOrTimeout.filter((thread): thread is RelevantThread => thread !== null);

    console.log('[findRelevantThreads] Successfully fetched', relevantThreads.length, 'threads');

    // Generate summary
    const summary = relevantThreads.length > 0
      ? `Found ${relevantThreads.length} relevant thread(s) in channel history`
      : 'Found relevant messages but no threads with replies';

    return { relevantThreads, summary };

  } catch (error) {
    console.error('[findRelevantThreads] Error during thread discovery:', error);
    // Return empty result on error - graceful degradation
    return { relevantThreads: [], summary: 'Thread discovery failed, continuing without thread context' };
  }
}

/**
 * Resolve a full name (e.g. from Snowflake OWNER_NAME) to a Slack user ID.
 * Paginates through users.list and matches on real_name (case-insensitive).
 * Returns null if no match found or on error.
 */
export async function lookupSlackUserIdByName(name: string): Promise<string | null> {
  try {
    const normalized = name.trim().toLowerCase();
    let cursor: string | undefined;
    do {
      const result = await client.users.list({ limit: 200, cursor });
      const match = result.members?.find(
        (m) => m.real_name?.toLowerCase() === normalized
      );
      if (match?.id) return match.id;
      cursor = result.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return null;
  } catch (error) {
    console.error('[lookupSlackUserIdByName] Error:', error);
    return null;
  }
}
