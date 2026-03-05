import { client } from "./slack-utils";

interface TicketDetails {
  customer: string; // Customer identifier
  customerName: string; // Customer company name
  customerSegment?: string; // e.g., "Enterprise", "Pro", "Hobby"
  teamId: string; // Format: team_XXXXXXXXXXXXXXXXXXXXXXXX
  notionLink?: string; // Optional Notion account tracking link
  projectId?: string; // Format: prj_XXXXXXXXXXXXXXXXXXXXXXXX (optional)
  slackChannelId?: string; // Customer-facing Slack channel ID
  slackChannelName?: string; // Customer-facing Slack channel name
  slackInternalChannelId?: string; // Internal Slack channel ID
  slackInternalChannelName?: string; // Internal Slack channel name
  priority?: string; // e.g., "SEV 1/Urgent", "SEV 2/High", "SEV 3/Non-Urgent"
  elevatedPriorityContext?: string; // Context if priority is elevated
  request: string; // The main request/issue description
  slackThreadUrl?: string; // Link back to Slack thread
  issueCategory?: string; // For internal tracking
  issueTitle: string; // Concise title for the ticket
}

export const postTicketCreationMessage = async (details: TicketDetails) => {
  const ticketChannelId = process.env.SLACK_TICKET_CHANNEL_ID?.trim();

  if (!ticketChannelId) {
    throw new Error(
      "SLACK_TICKET_CHANNEL_ID not configured. Please set this environment variable to the channel where tickets should be created."
    );
  }

  const {
    customer,
    customerName,
    customerSegment,
    teamId,
    notionLink,
    projectId,
    slackChannelId,
    slackChannelName,
    slackInternalChannelId,
    slackInternalChannelName,
    priority,
    elevatedPriorityContext,
    request,
    slackThreadUrl,
    issueCategory,
    issueTitle,
  } = details;

  const priorityDisplay = (priority || "🟡 SEV 3/Non-Urgent")
    .replace("🔴", ":red_circle:")
    .replace("🟠", ":large_orange_circle:")
    .replace("🟡", ":large_yellow_circle:");

  let plainText = `:ticket: *${issueTitle}*\n\n`;
  plainText += `:bust_in_silhouette: *Customer:* ${customer} (${customerName})\n`;
  plainText += `:office: *Segment:* ${customerSegment || "Unknown"}\n`;
  const adminLink = teamId && teamId !== "team_unknown"
    ? ` <https://admin.vercel.com/team/${teamId}|Admin>`
    : "";
  plainText += `:key: *Team ID:* \`${teamId}\`${adminLink}\n`;
  if (slackChannelId || slackInternalChannelId) {
    const parts = [
      slackChannelId ? `<#${slackChannelId}>` : null,
      slackInternalChannelId ? `<#${slackInternalChannelId}>` : null,
    ].filter(Boolean);
    plainText += `:slack: *Channels:* ${parts.join("  |  ")}\n`;
  }
  plainText += `:file_folder: *Project ID:* \`${projectId || "prj_unknown"}\`\n`;
  if (notionLink) {
    plainText += `:notebook: *Notion:* ${notionLink}\n`;
  }
  plainText += `:fire: *Priority:* ${priorityDisplay}`;
  if (elevatedPriorityContext) {
    plainText += ` — ${elevatedPriorityContext}`;
  }
  plainText += `\n\n${request}\n`;
  if (slackThreadUrl) {
    plainText += `\n<${slackThreadUrl}|Slack Thread>`;
    if (issueCategory) {
      plainText += `  |  AI Classification: ${issueCategory}`;
    }
  } else if (issueCategory) {
    plainText += `\nAI Classification: ${issueCategory}`;
  }

  try {
    // HYPOTHESIS TEST: Send without blocks to preserve formatting
    // When blocks are present, text becomes a fallback for notifications
    // Without blocks, text should be treated as main content (like user messages)
    const result = await client.chat.postMessage({
      channel: ticketChannelId,
      text: plainText,
      mrkdwn: true,
    });

    return {
      success: true,
      channelId: ticketChannelId,
      messageTs: result.ts,
    };
  } catch (error) {
    console.error("Error posting ticket creation message:", error);
    throw error;
  }
};
