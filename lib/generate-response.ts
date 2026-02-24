import { ModelMessage, generateText, tool, stepCountIs } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { postTicketCreationMessage } from "./create-ticket-message";

// Initialize gateway - when deployed to Vercel, OIDC is used automatically
// IMPORTANT: Don't pass apiKey property at all to enable OIDC on Vercel
// If an API key is present, it will always be used instead of OIDC
const gatewayApiKey = process.env.AI_GATEWAY_API_KEY?.trim();
console.log('[gateway] Initializing gateway. Has API key:', !!gatewayApiKey);
const gateway = createGateway(
  gatewayApiKey && gatewayApiKey.length > 0
    ? { apiKey: gatewayApiKey }
    : {} // Empty object allows OIDC to work on Vercel
);
console.log('[gateway] Gateway initialized');

export const generateResponse = async (
  messages: ModelMessage[],
  updateStatus?: (status: string) => void,
  slackThreadUrl?: string,
  channelHistory?: string,
  enrichedContext?: string,
  accountInfo?: any,
) => {
  console.log('[generateResponse] Starting response generation');
  console.log('[generateResponse] Messages:', JSON.stringify(messages, null, 2));
  console.log('[generateResponse] Has channel history:', !!channelHistory);
  console.log('[generateResponse] Has enriched context:', !!enrichedContext);

  try {
    const systemPrompt = `You are an intake assistant for the Vercel Developer Success Engineering (DSE) team.

IMPORTANT: You are an INTERNAL tool used by field team members (AEs, CSMs, SEs) to triage customer issues and determine routing.
- You are @mentioned by field team members in customer Slack channels
- You review the channel/thread history to understand the customer's issue
- You determine if the issue is in DSE scope or should route to another team
- If in-scope: Create a DSE ticket with full context
- If out-of-scope: Provide specific routing guidance to the field team member

Your role is NOT to solve technical problems directly, but to:
1. Review the request from the field team member
2. Determine if it's in-scope for DSE
3. If it's an INFORMATIONAL question about DSE: Provide a clear, helpful answer about DSE capabilities
4. If it's a CUSTOMER ISSUE (new or ongoing) that's in-scope: Create a DSE ticket automatically with full context from the channel history
5. If it's a request to TRACK ONGOING DSE WORK: Create a DSE ticket to document the work (state of work doesn't matter)
6. If out-of-scope: Explain to the field team member which team should handle this

IMPORTANT: Work state (not started, in progress, completed) does NOT determine if it's in-scope. Only the TYPE of work matters. If DSE is already investigating cold starts, creating a ticket to track that work IS in-scope.

## DSE Team Capabilities (in-scope requests):

**Time-boxed onboarding & enablement:**
- Structured onboarding sessions for Vercel features and best practices
- Go-live support and hypercare for critical launches

**Deep technical debugging & performance:**
- Investigating cold starts, latency, routing, caching, ISR behavior
- Using observability, tracing, and logs to diagnose issues
- Reproducing problems and recommending fixes

**Usage, cost, and efficiency guidance:**
- Analyzing usage drivers (Fast Data Transfer, Edge Requests, ISR writes)
- Investigating overage spikes after framework upgrades or config changes
- Performance vs cost optimization recommendations

**Product & feature guidance:**
- How to use Vercel features (Skew Protection, Session Tracing, Bot Protection, etc.)
- Framework behavior on Vercel (Next.js caching, routing, prefetching)

**One-off technical guidance:**
- Design pattern reviews
- Architecture feedback
- Challenging Next.js/Vercel bugs

## Response Format (for field team members):

1. **Acknowledge** - Confirm what was asked
2. **Classify** - Determine the type of request
3. **Respond appropriately:**

   **If INFORMATIONAL question about DSE:**
   - Provide a clear, concise answer about DSE capabilities, scope, or when to engage
   - List relevant DSE capabilities with bullet points
   - Do NOT create a ticket (this is just an information request)
   - Keep it brief and actionable

   **If CUSTOMER ISSUE that's IN-SCOPE (new or ongoing work):**
   - Briefly explain how DSE can help with this type of issue (or is already helping)
   - Create a DSE ticket automatically using the createTicket tool
   - If work is already in progress, acknowledge that in the ticket summary
   - Confirm ticket has been created for tracking/coordination

   **If OUT-OF-SCOPE:**
   - Clearly state which team should handle this
   - Provide specific routing instructions (e.g., "Customer should create support ticket at vercel.com/help" or "Route to AE/CSM + Professional Services")
   - Briefly explain why it's out of DSE scope

## Important Guidelines:
- You are responding to the FIELD TEAM MEMBER (AE/CSM/SE), not the customer directly
- Do NOT provide technical solutions in your response - DSE team will handle that
- Keep responses concise (2-3 paragraphs maximum)
- Always search channel history for context (Team IDs, Project IDs, customer details)
- Current date is: ${new Date().toISOString().split("T")[0]}

## Customer Context Extraction (for ticket creation):
When offering to create a ticket, you need to extract:
- Customer identifiers, company names, or account information
- Vercel team IDs (format: team_XXXXXXXXXXXXXXXXXXXXXXXX)
- Project IDs (format: prj_XXXXXXXXXXXXXXXXXXXXXXXX)
- Customer segment if mentioned (Enterprise, Pro, Hobby)
- Urgency and impact to determine priority (production issues = higher priority)

## Channel History Context:
${channelHistory ? `You have access to recent channel history (${Math.round(channelHistory.length / 1000)}KB of messages) via the searchChannelHistory tool. Use it to look for:
- Team IDs and Project IDs that may have been mentioned earlier in the conversation
- Customer names or company names
- Previous discussions about the same issue
- Any additional context that would be helpful for the DS team

The searchChannelHistory tool will search through the full channel history and return relevant matches.` : ""}

IMPORTANT: Before creating a ticket, if any required information (team ID, customer name, etc.) is missing from the immediate conversation, use the searchChannelHistory tool to look for this information in the broader channel history. Always try to gather as much context as possible from the channel history before creating the ticket.

For CUSTOMER ISSUES that are IN-SCOPE (new or ongoing): After reviewing the customer issue and gathering context, ALWAYS create a DSE ticket automatically by using the createTicket tool. Do not ask for permission - just create it and confirm to the field team member that the ticket has been created. If DSE is already engaged, make sure the ticket summary reflects the current state of work (e.g., "DSE is actively investigating revalidatePath issue, created reproduction, coordinating with CDN/Next.js teams").

For INFORMATIONAL questions about DSE: Do NOT create a ticket. These are field team members asking about DSE capabilities, not customer issues requiring DSE engagement. Simply provide a helpful answer.${enrichedContext ? `\n\n${enrichedContext}` : ''}${accountInfo ? `\n\n## Salesforce Account Context (from Slack channel):\n- Customer Name: ${accountInfo.NAME}\n- Team ID: ${accountInfo.TEAM_ID_C || 'Not available'}\n- Account Segment: ${accountInfo.SUBSCRIPTION_PLAN_C || 'Unknown'}\n- Account ID: ${accountInfo.ID}\n\nThis account information was automatically retrieved from Salesforce based on the Slack channel where the original message was posted. Use this to pre-fill ticket details.` : ''}`;

    console.log('[generateResponse] System prompt length:', systemPrompt.length);
    console.log('[generateResponse] Number of messages:', messages.length);
    console.log('[generateResponse] Calling generateText...');

    const response = await generateText({
      model: gateway("openai/gpt-4o"),
      system: systemPrompt,
      messages,
      stopWhen: stepCountIs(5), // Allow up to 5 steps for tool calling (search history, create ticket, etc.)
      tools: {
      searchChannelHistory: tool({
        description: "Search through the recent channel history to find specific information like team IDs, project IDs, customer names, or other context. Use this tool BEFORE creating a ticket if you're missing required information.",
        inputSchema: z.object({
          searchQuery: z.string().describe("What you're looking for (e.g., 'team ID', 'project ID', 'customer name', 'company name')"),
        }),
        execute: async ({ searchQuery }: { searchQuery: string }) => {
          if (!channelHistory) {
            return {
              found: false,
              message: "No channel history available to search.",
            };
          }

          // Simple keyword search in the channel history
          const lowerQuery = searchQuery.toLowerCase();
          const historyLines = channelHistory.split("\n");

          // Look for team IDs (format: team_XXXXXXXXXXXXXXXXXXXXXXXX)
          const teamIdMatches = channelHistory.match(/team_[a-zA-Z0-9]{24,}/g);

          // Look for project IDs (format: prj_XXXXXXXXXXXXXXXXXXXXXXXX)
          const projectIdMatches = channelHistory.match(/prj_[a-zA-Z0-9]{24,}/g);

          // Find relevant lines that contain the search query
          const relevantLines = historyLines
            .filter(line => line.toLowerCase().includes(lowerQuery))
            .slice(0, 10); // Limit to 10 most relevant lines

          const results = {
            found: relevantLines.length > 0 || (teamIdMatches && teamIdMatches.length > 0) || (projectIdMatches && projectIdMatches.length > 0),
            teamIds: teamIdMatches ? [...new Set(teamIdMatches)] : [],
            projectIds: projectIdMatches ? [...new Set(projectIdMatches)] : [],
            relevantContext: relevantLines.join("\n"),
            message: relevantLines.length > 0
              ? `Found ${relevantLines.length} relevant mentions in channel history.`
              : "No direct matches found in channel history.",
          };

          return results;
        },
      }),
      createTicket: tool({
        description: "Create a DSE support ticket for the customer issue. Use this tool AUTOMATICALLY for in-scope requests after reviewing the channel history. Extract as much customer context as possible (Team IDs, Project IDs, customer details) from the conversation and channel history. Generate a concise summary of the customer's issue for the DSE team to investigate.",
        inputSchema: z.object({
          customer: z.string().describe("Customer identifier or email of the person requesting support"),
          customerName: z.string().describe("Customer's company/organization name"),
          customerSegment: z.enum(["Enterprise", "Pro", "Hobby", "Unknown"]).optional().describe("Customer's Vercel plan segment if known from context"),
          teamId: z.string().describe("Customer's Vercel team ID in format team_XXXXXXXXXXXXXXXXXXXXXXXX. If not provided in conversation, use 'team_unknown'"),
          notionLink: z.string().optional().describe("Notion link for account tracking if the customer account is known. Find it at https://www.notion.so/vercel/1b6e06b059c48055a637c5f6de528de7"),
          projectId: z.string().optional().describe("Customer's Vercel project ID in format prj_XXXXXXXXXXXXXXXXXXXXXXXX if mentioned in the conversation"),
          priority: z.enum(["🔴 SEV 1/Urgent", "🟠 SEV 2/High", "🟡 SEV 3/Non-Urgent"]).optional().describe("Priority level based on urgency and customer impact. Default to SEV 3 unless customer is blocked or experiencing production issues"),
          elevatedPriorityContext: z.string().optional().describe("If priority is SEV 1 or SEV 2, provide context explaining why it's urgent (e.g., production down, customer escalation)"),
          issueCategory: z.enum([
            "technical-troubleshooting",
            "onboarding-enablement",
            "performance-optimization",
            "usage-cost-guidance",
            "product-feature-guidance"
          ]).describe("Category of the issue for internal tracking (only in-scope DS categories)"),
          issueTitle: z.string().describe("A short, concise title for the ticket (5-10 words max). Examples: 'Investigate Fluid Compute session overlap', 'Cold start performance degradation', 'ISR cache not invalidating'"),
          issueSummary: z.string().describe("A concise 2-4 sentence summary of the issue/request from the conversation. Focus on the problem, impact, and what the customer needs help with. Do NOT copy the entire conversation - just summarize the key points."),
        }),
        execute: async ({
          customer,
          customerName,
          customerSegment,
          teamId,
          notionLink,
          projectId,
          priority,
          elevatedPriorityContext,
          issueCategory,
          issueTitle,
          issueSummary,
        }: {
          customer: string;
          customerName: string;
          customerSegment?: "Enterprise" | "Pro" | "Hobby" | "Unknown";
          teamId: string;
          notionLink?: string;
          projectId?: string;
          priority?: "🔴 SEV 1/Urgent" | "🟠 SEV 2/High" | "🟡 SEV 3/Non-Urgent";
          elevatedPriorityContext?: string;
          issueCategory: "technical-troubleshooting" | "onboarding-enablement" | "performance-optimization" | "usage-cost-guidance" | "product-feature-guidance";
          issueTitle: string;
          issueSummary: string;
        }) => {
          updateStatus?.("is posting ticket to DS team channel...");

          // Use the AI-generated summary instead of copying all messages
          const requestWithThread = slackThreadUrl
            ? `${issueSummary}\n\n_Slack Thread:_ ${slackThreadUrl}`
            : issueSummary;

          try {
            const result = await postTicketCreationMessage({
              customer,
              customerName,
              customerSegment,
              teamId,
              notionLink,
              projectId,
              priority,
              elevatedPriorityContext,
              request: requestWithThread,
              slackThreadUrl,
              issueCategory,
              issueTitle,
            });

            return {
              success: true,
              message: `✅ DSE ticket created successfully! Posted to DSE team channel with:\n- Customer: ${customerName}\n- Team ID: ${teamId}\n- Priority: ${priority || "🟡 SEV 3/Non-Urgent"}\n\nDSE team will investigate and provide guidance.`,
              channelId: result.channelId,
            };
          } catch (error) {
            console.error("Failed to post ticket creation message:", error);
            return {
              success: false,
              error: `Failed to post ticket: ${error instanceof Error ? error.message : "Unknown error"}`,
            };
          }
        },
      }),
    },
  });

    console.log('[generateResponse] Full response object:', JSON.stringify({
      text: response.text?.substring(0, 200),
      textLength: response.text?.length || 0,
      finishReason: response.finishReason,
      usage: response.usage,
      toolCalls: response.toolCalls?.length || 0,
    }, null, 2));

    console.log('[generateResponse] Generated text length:', response.text?.length || 0);
    console.log('[generateResponse] Generated text preview:', response.text?.substring(0, 200));

    if (!response.text || response.text.trim().length === 0) {
      console.error('[generateResponse] ERROR: Generated text is empty!');
      return "⚠️ The AI response was empty. Please try rephrasing your request.";
    }

    // Convert markdown to Slack mrkdwn format
    const formattedText = response.text.replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>").replace(/\*\*/g, "*");
    console.log('[generateResponse] Successfully generated response');
    return formattedText;

  } catch (error) {
    console.error('[generateResponse] ERROR during text generation:', error);
    console.error('[generateResponse] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return "⚠️ An error occurred while generating the response. Please check the logs and try again.";
  }
};
