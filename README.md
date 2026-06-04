# AI SDK Slackbot

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnicoalbanese%2Fai-sdk-slackbot&env=SLACK_BOT_TOKEN,SLACK_SIGNING_SECRET,OPENAI_API_KEY,EXA_API_KEY&envDescription=API%20keys%20needed%20for%20application&envLink=https%3A%2F%2Fgithub.com%2Fnicoalbanese%2Fai-sdk-slackbot%3Ftab%3Dreadme-ov-file%234-set-environment-variables&project-name=ai-sdk-slackbot)

An AI-powered chatbot for Slack powered by the [AI SDK by Vercel](https://sdk.vercel.ai/docs).

## Features

- Integrates with [Slack's API](https://api.slack.com) for easy Slack communication
- Use any LLM with the AI SDK ([easily switch between providers](https://sdk.vercel.ai/providers/ai-sdk-providers))
- Works both with app mentions and as an assistant in direct messages
- Maintains conversation context within both threads and direct messages
- Built-in tools for enhanced capabilities:
  - Real-time weather lookup
  - Web search (powered by [Exa](https://exa.ai))
  - Sandboxed `bash` (via [bash-tool](https://github.com/vercel-labs/bash-tool) + [just-bash](https://github.com/vercel-labs/just-bash))
- **Policy-gated tool calls** — every tool call is checked against Open Policy Agent (Rego) policies in [`policies/`](./policies), editable without touching TypeScript. See [policies/README.md](./policies/README.md).
- Easily extensible architecture to add custom tools (e.g., knowledge search)

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ installed
- Slack workspace with admin privileges
- [OpenAI API key](https://platform.openai.com/api-keys) (default model), **or** a local [Ollama](https://ollama.com) install (see [Optional: local model](#optional-run-a-local-model-with-ollama))
- [Exa API key](https://exa.ai) (for web search functionality)
- A server or hosting platform (e.g., [Vercel](https://vercel.com)) to deploy the bot
- [OPA](https://www.openpolicyagent.org/docs/latest/#running-opa) (`opa`) — only needed to edit policies (`pnpm policy:build` / `pnpm policy:test`); the committed `policies/policy.wasm` runs without it

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
      - `channels:history` (read thread history when continuing a conversation in a public channel; add `groups:history` for private channels and `mpim:history` for group DMs)
      - `im:history`
      - `im:read`
      - `im:write`
   - Install the app to your workspace and note down the "Bot User OAuth Token" for the environment variable `SLACK_BOT_TOKEN`

   > Scopes are easy to miss: `channels:history` is required to **continue a conversation in a thread** (mention in a public channel). If you add scopes after installing, you must **reinstall the app** to your workspace for them to take effect.

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

### 4. Set Environment Variables

Create a `.env` file in the root of your project with the following:

```
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Model provider (defaults to OpenAI gpt-4o)
OPENAI_API_KEY=your-openai-api-key

# Exa API Key (for web search functionality)
EXA_API_KEY=your-exa-api-key
```

Replace the placeholder values with your actual tokens. See [`.env.example`](./.env.example) for optional settings (`MODEL_PROVIDER`, `OLLAMA_MODEL`, `OPENAI_MODEL`, `POLICY_MODE`).

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
   - `OPENAI_API_KEY`
   - `EXA_API_KEY`

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

### Extending with New Tools

The chatbot is built with an extensible architecture using the [AI SDK's tool system](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling). You can easily add new tools such as:

- Knowledge base search
- Database queries
- Custom API integrations
- Company documentation search

To add a new tool, extend the tools object in the `lib/generate-response.ts` file following the existing pattern.

You can also disable any of the existing tools by removing the tool in the `lib/generate-response.ts` file.

## Policies

Every tool call is gated by Open Policy Agent (Rego) policies in [`policies/decision.rego`](./policies/decision.rego) — you can change what the bot is allowed to do by editing that file, no TypeScript changes required. `POLICY_MODE` defaults to in-process WASM (the committed `policies/policy.wasm`), so running the bot needs no `opa` binary. See [policies/README.md](./policies/README.md) for the input shape, how to add a rule, dev (HTTP hot-reload) vs prod (WASM), and `pnpm policy:test`.

### What the policy does and does not guarantee

The policy gates **tool calls** — what a tool is allowed to *do*. It does **not**
constrain the model's free text. For example, the `searchWeb` policy guarantees a
web search only ever queries `vercel.com`; it cannot stop the model from then
answering a question from its own training knowledge (e.g. explaining Bitcoin even
when the vercel.com search returned nothing). The system prompt asks the model to
answer only from tool results, but that is best-effort, not enforced — a hard
"only answer from allowed sources" guarantee would require output-side validation
(checking the answer is supported by the tool results before sending), which is
out of scope here. The `🔧` footer on each reply shows which tool actually ran, so
a tool-less or unscoped answer is at least visible.

## Optional: run a local model with Ollama

Instead of OpenAI you can run a local model for free, offline:

```sh
brew install ollama        # or download from https://ollama.com
ollama pull llama3.1
ollama serve               # if not already running
```

Then set `MODEL_PROVIDER=ollama` in `.env`. You don't need an `OPENAI_API_KEY` on this path — a full `.env` for local Ollama looks like:

```
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret

# Use a local Ollama model instead of OpenAI (no OPENAI_API_KEY needed)
MODEL_PROVIDER=ollama
OLLAMA_MODEL=llama3.1        # optional; defaults to llama3.1

# Exa API Key (only needed if you want web search to run)
EXA_API_KEY=your-exa-api-key
```

> Small models like `llama3.1:8b` sometimes call tools when they shouldn't (e.g. answering "hi" with a weather report) or invent sources. `qwen2.5` follows tool instructions more reliably — `ollama pull qwen2.5` and set `OLLAMA_MODEL=qwen2.5`. The default hosted model (`gpt-4o`) doesn't have this problem.

> Local only: Ollama serves on `localhost:11434`, which a deployed Vercel function cannot reach. Use Ollama for local development; deploy with a hosted provider (the default OpenAI, or point a provider at a reachable host).

## License

MIT
