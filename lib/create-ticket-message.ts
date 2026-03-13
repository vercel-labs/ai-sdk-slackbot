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
  ae?: string; // AE Slack user ID (OWNER_NAME resolved) or display name fallback
  csm?: string; // CSM Slack user ID (CUSTOMER_SUCCESS_MANAGER_NAME resolved) or display name fallback
  request: string; // The main request/issue description
  slackThreadUrl?: string; // Link back to Slack thread
  issueCategory?: string; // For internal tracking
  issueTitle: string; // Concise title for the ticket
  requestingUserId?: string; // Slack user ID of the person who submitted the request
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
    ae,
    csm,
    request,
    slackThreadUrl,
    issueCategory,
    issueTitle,
    requestingUserId,
  } = details;

  const priorityDisplay = (priority || "🟡 SEV 3/Non-Urgent")
    .replace("🔴", ":red_circle:")
    .replace("🟠", ":large_orange_circle:")
    .replace("🟡", ":large_yellow_circle:");

  const teamIdText = teamId && teamId !== "team_unknown"
    ? `\`${teamId}\` | <https://admin.vercel.com/team/${teamId}|Admin>`
    : "Unknown";

  const channelParts = [
    slackInternalChannelId ? `<#${slackInternalChannelId}>` : null,
    slackChannelId ? `<#${slackChannelId}>` : null,
  ].filter(Boolean);
  const channelsText = channelParts.length ? channelParts.join(" | ") : "—";

  const formatPerson = (val?: string) =>
    val ? (/^U[A-Z0-9]+$/.test(val) ? `<@${val}>` : val) : "Unknown";

  const fields: any[] = [
    { type: "mrkdwn", text: `*Team ID*\n${teamIdText}` },
    { type: "mrkdwn", text: `*Customer*\n${customerName}` },
    { type: "mrkdwn", text: `*Segment*\n${customerSegment || "Unknown"}` },
    { type: "mrkdwn", text: `*AE/CSM*\n${formatPerson(ae)} / ${formatPerson(csm)}` },
    { type: "mrkdwn", text: `*Priority*\n${priorityDisplay}${elevatedPriorityContext ? ` — ${elevatedPriorityContext}` : ""}` },
    { type: "mrkdwn", text: `*Channels*\n${channelsText}` },
  ];

  let footerText = '';
  if (slackThreadUrl) {
    footerText = issueCategory
      ? `_<${slackThreadUrl}|Slack Thread>  |  AI Classification: ${issueCategory}_`
      : `_<${slackThreadUrl}|Slack Thread>_`;
  } else if (issueCategory) {
    footerText = `_AI Classification: ${issueCategory}_`;
  }

  const blocks: any[] = [];

  if (requestingUserId) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_Request Form Submission from <@${requestingUserId}>_` }],
    });
  }

  blocks.push(
    {
      type: "section",
      text: { type: "mrkdwn", text: `:ticket: *${issueTitle}*\n${request}` },
    },
    { type: "divider" },
    { type: "section", fields },
  );

  if (footerText) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: footerText }],
    });
  }

  try {
    const result = await client.chat.postMessage({
      channel: ticketChannelId,
      text: `${issueTitle}${requestingUserId ? ` (from <@${requestingUserId}>)` : ''}`,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
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
