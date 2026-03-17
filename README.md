# DS Help Agent

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnicoalbanese%2Fai-sdk-slackbot&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,OPENAI_API_KEY,EXA_API_KEY&envDescription=API%20keys%20needed%20for%20application&envLink=https%3A%2F%2Fgithub.com%2Fnicoalbanese%2Fai-sdk-slackbot%3Ftab%3Dreadme-ov-file%234-set-environment-variables&project-name=ai-sdk-slackbot)

An AI-powered Developer Success agent for Slack, built with the [AI SDK by Vercel](https://sdk.vercel.ai/docs). Intelligently routes support requests, provides technical guidance, and integrates with Linear for ticket management.

## Features

- Integrates with [Slack's API](https://api.slack.com) for easy Slack communication
- Uses [Vercel AI Gateway](https://vercel.com/ai-gateway) for unified access to multiple AI providers (OpenAI, Anthropic, Google, and more)
- Easily switch between AI models and providers with a simple configuration change
- Works both with app mentions and as an assistant in direct messages
- Maintains conversation context within both threads and direct messages
- **Smart request routing**: Automatically classifies requests to ensure they're in scope for Developer Success team
- **Linear ticket creation**: After responding to in-scope requests, the agent can create Linear tickets with full context for tracking and follow-up
- Built-in tools for enhanced capabilities:
  - Real-time weather lookup
  - Web search (powered by [Exa](https://exa.ai))
  - Linear ticket creation with customer context
- Easily extensible architecture to add custom tools (e.g., knowledge search)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- Slack workspace with admin privileges
- [Vercel AI Gateway API key](https://vercel.com/docs/ai-gateway/getting-started) (optional for local development, not required when deployed to Vercel)
- [Exa API key](https://exa.ai) (for web search functionality)
- [Linear Slack bot](https://linear.app/integrations/slack) installed in your workspace (for ticket creation functionality)
- A dedicated Slack channel for DS support tickets
- A server or hosting platform (e.g., [Vercel](https://vercel.com)) to deploy the bot

## Setup

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch" and give your app a name
3. Select your workspace

### 3. Configure Slack App Settings

- Go to "Basic Information"
   - Under "App Credentials", note down your "Signing Secret". This will be an environment variable `SLACK_SIGNING_SECRET`
- Go to "App Home"
  - Under Show Tabs -> Messages Tab, Enable "Allow users to send Slash commands and messages from the messages tab"
- Go to "OAuth & Permissions"
   - Add the following [Bot Token Scopes](https://api.slack.com/scopes):
      - `app_mentions:read`
      - `assistant:write`
      - `chat:write`
      - `im:history`
      - `im:read`
      - `im:write`
   - Install the app to your workspace and note down the "Bot User OAuth Token" for the environment variable `SLACK_BOT_TOKEN`

- Go to "Event Subscriptions"
   - Enable Events
   - Set the Request URL to either
      - your deployment URL: (e.g. `https://your-app.vercel.app/api/events`)
      - or, for local development, use the tunnel URL from the [Local Development](./README.md#local-development) section below
   - Under "Subscribe to bot events", add:
      - `app_mention`
      - `assistant_thread_started`
      - `message:im`
   - Save Changes

> Remember to include `/api/events` in the Request URL.

You may need to refresh Slack with CMD+R or CTRL+R to pick up certain changes, such as enabling the chat tab

### 4. Set Up Linear Slack Integration

1. Install the [Linear Slack app](https://linear.app/integrations/slack) in your workspace
2. Create a dedicated Slack channel for DS support tickets (e.g., `#ds-support-tickets`)
3. Invite the Linear bot to this channel
4. Copy the channel ID (right-click channel → View channel details → copy the ID from the bottom)
5. You'll use this channel ID in your environment variables

### 5. Set Environment Variables

Create a `.env` file in the root of your project with the following:

```
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Vercel AI Gateway
# Get this from your Vercel dashboard (navigate to AI Gateway > API Keys)
# Note: When deployed to Vercel, OIDC authentication is used automatically and this key is not required
AI_GATEWAY_API_KEY=your-ai-gateway-api-key

# Exa API Key (for web search functionality)
EXA_API_KEY=your-exa-api-key

# Ticket Channel (for posting DS support tickets)
# This is the Slack channel ID where ticket requests will be posted
# The Linear Slack bot should be active in this channel to create tickets
SLACK_TICKET_CHANNEL_ID=your-channel-id
```

Replace the placeholder values with your actual tokens.

**Note:** The AI Gateway gives you access to multiple AI providers (OpenAI, Anthropic, Google, etc.) through a single API key. When deployed to Vercel, authentication happens automatically via OIDC and no API key is needed.

## Local Development

Use the [Vercel CLI](https://vercel.com/docs/cli) and [untun](https://github.com/unjs/untun) to test out this project locally:

```sh
pnpm i -g vercel
pnpm vercel dev --listen 3000 --yes
```

```sh
npx untun@latest tunnel http://localhost:3000
```

Make sure to modify the [subscription URL](./README.md/#enable-slack-events) to the `untun` URL.

> Note: you may encounter issues locally with `waitUntil`. This is being investigated.

## Production Deployment

### Deploying to Vercel

1. Push your code to a GitHub repository

2. Deploy to [Vercel](https://vercel.com):

   - Go to vercel.com
   - Create New Project
   - Import your GitHub repository

3. Add your environment variables in the Vercel project settings:

   - `SLACK_BOT_TOKEN`
   - `SLACK_SIGNING_SECRET`
   - `AI_GATEWAY_API_KEY` (optional - OIDC authentication is used automatically when deployed to Vercel)
   - `EXA_API_KEY`
   - `SLACK_TICKET_CHANNEL_ID` (the channel where DS tickets should be posted)

4. After deployment, Vercel will provide you with a production URL

5. Update your Slack App configuration:
   - Go to your [Slack App settings](https://api.slack.com/apps)
   - Select your app

   - Go to "Event Subscriptions"
      - Enable Events
      - Set the Request URL to: `https://your-app.vercel.app/api/events`
   - Save Changes

## Usage

The bot will respond to:

1. Direct messages - Send a DM to your bot
2. Mentions - Mention your bot in a channel using `@YourBotName`

The bot maintains context within both threads and direct messages, so it can follow along with the conversation.

### Available Tools

1. **Weather Tool**: The bot can fetch real-time weather information for any location.

   - Example: "What's the weather like in London right now?"

2. **Web Search**: The bot can search the web for up-to-date information using [Exa](https://exa.ai).
   - Example: "Search for the latest news about AI technology"
   - You can also specify a domain: "Search for the latest sports news on bbc.com"

3. **Ticket Creation**: After responding to in-scope Developer Success requests, the bot posts a formatted Block Kit message to your DS tickets channel. The message uses a structured 2-column fields grid:
   - **Attribution** (small/muted): who submitted the request
   - **Title + request body**: prominent section block
   - **Metadata grid** (3 rows):
     - Team ID (with inline Admin link) | Customer name
     - Segment | AE/CSM (auto-resolved to `@mention` via Slack user lookup from Snowflake `OWNER_NAME` / `CUSTOMER_SUCCESS_MANAGER_NAME`)
     - Priority | Channels (internal | customer-facing)
   - **Footer** (small/muted): Slack thread link + AI classification
   - Simply ask: "Can you create a ticket for this?" or the bot will create one automatically for in-scope requests

### Request Classification

The bot includes intelligent request routing to ensure it only handles requests within the Developer Success team's scope:

- **In Scope**: Technical troubleshooting, best practices, Vercel/Next.js issues, AI SDK support
- **Out of Scope**: Billing, contracts, sales inquiries → Bot politely redirects to appropriate team

### Extending with New Tools

The chatbot is built with an extensible architecture using the [AI SDK's tool system](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling). You can easily add new tools such as:

- Knowledge base search
- Database queries
- Custom API integrations
- Company documentation search

To add a new tool, extend the tools object in the `lib/generate-response.ts` file following the existing pattern.

You can also disable any of the existing tools by removing the tool in the `lib/generate-response.ts` file.

### Switching AI Models

Thanks to Vercel AI Gateway, you can easily switch between different AI providers and models. Simply update the model string in `lib/generate-response.ts`:

```typescript
// OpenAI GPT-4o (default)
model: "openai/gpt-4o"

// Anthropic Claude
model: "anthropic/claude-3-5-sonnet-20241022"

// Google Gemini
model: "google/gemini-1.5-pro"

// OpenAI GPT-4o-mini (faster, cheaper)
model: "openai/gpt-4o-mini"
```

No other code changes or additional API keys are required!

## Testing

Deploy the branch to a staging environment on Vercel, then call the bot with `--preview` appended to your message:

```
@DSHelpBot <your request> --preview
```

This lets you verify ticket message formatting (fields grid, AE/CSM mentions, context blocks) against the staging deployment before merging.

## License

MIT
