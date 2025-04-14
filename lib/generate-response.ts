import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText, tool } from "ai";
import { z } from "zod";
import {
	initNotionMCPServer,
	setupShutdownHandlers,
} from "./notion-mcp-server";

// プロセス終了時にNotion MCPサーバーを停止するためのハンドラーを設定
setupShutdownHandlers();

export const generateResponse = async (
	messages: CoreMessage[],
	updateStatus?: (status: string) => Promise<void>,
) => {
	// ステータスメッセージを設定
	if (updateStatus) {
		await updateStatus("考え中...");
	}

	const { text } = await generateText({
		model: openai("gpt-4o-mini"),
		system: `You are a Slack bot assistant Keep your responses concise and to the point.
    - Do not tag users.
    - Current date is: ${new Date().toISOString().split("T")[0]}
    - Make sure to ALWAYS include sources in your final response if you use web search or Notion search. Put sources inline if possible.
    - When users ask about company-specific information, documents, or internal knowledge, use the searchNotion tool.
    - Only use the searchNotion tool when the query is likely to be about internal company information.
    - For general questions about common topics (like food, weather, general knowledge), use your own knowledge.
    - For simple greetings like "hello" or "good morning", respond naturally without using tools.`,
		messages,
		maxSteps: 10,
		tools: {
			searchNotion: tool({
				description: "Search for documents in Notion based on a query",
				parameters: z.object({
					query: z
						.string()
						.describe("The search query to find documents in Notion"),
				}),
				execute: async ({ query }) => {
					// ステータスメッセージを更新
					if (updateStatus) {
						await updateStatus(`Notionで「${query}」を検索中...`);
					}

					try {
						// Notion MCPサーバーのクライアントを初期化
						const mcpClient = await initNotionMCPServer();

						// 検索ツールを取得
						// 公式のNotion MCPサーバーでは、ツール名は「API-post-search」
						const searchTool = {
							call: async (params: Record<string, unknown>) => {
								return mcpClient.sendRequest("tools/call", {
									name: "API-post-search",
									arguments: params,
								});
							},
						};

						// 検索を実行
						const searchResults = await searchTool.call({
							query,
						});

						// 検索結果がない場合
						if (
							!searchResults ||
							!searchResults.results ||
							searchResults.results.length === 0
						) {
							return {
								success: true,
								message: "No documents found matching your query.",
								results: [],
							};
						}

						// 検索結果を整形
						const formattedResults = searchResults.results.map(
							(result: Record<string, unknown>) => {
								return {
									title: result.title || "Untitled",
									url: result.url || "",
									lastEditedTime: result.last_edited_time || "",
									snippet: result.snippet || "",
								};
							},
						);

						return {
							success: true,
							message: `Found ${formattedResults.length} document(s) matching your query.`,
							results: formattedResults,
						};
					} catch (error) {
						console.error("Error searching Notion:", error);
						return {
							success: false,
							message: `Error searching Notion: ${
								error instanceof Error ? error.message : String(error)
							}`,
							results: [],
						};
					}
				},
			}),
		},
	});

	// Convert markdown to Slack mrkdwn format
	const formattedText = text
		.replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
		.replace(/\*\*/g, "*");

	return formattedText;
};
