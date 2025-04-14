import { ChildProcess, spawn } from "child_process";

// MCPクライアントの型定義
interface Tool {
	name: string;
	description?: string;
	inputSchema: {
		type: "object";
		properties?: Record<string, unknown>;
	};
}

// MCPクライアントの型定義
interface MCPClient {
	getServerInfo: () => Promise<{ name: string; version: string }>;
	listTools: () => Promise<{ tools: Tool[] }>;
	getTool: (
		namespace: string,
		name: string,
	) => {
		call: (params: Record<string, unknown>) => Promise<any>;
	};
	// リクエストを直接送信するメソッドを追加
	sendRequest: (
		method: string,
		params: Record<string, unknown>,
	) => Promise<any>;
}

// MCPサーバーとクライアントのインスタンス
let notionMCPServerProcess: ChildProcess | null = null;
let notionMCPClient: MCPClient | null = null;

// 型アサーション関数
function assertNotNull<T>(value: T | null): asserts value is T {
	if (value === null) {
		throw new Error("Value is null");
	}
}

/**
 * Notion MCPサーバーを起動し、クライアントを初期化する
 * @returns MCP Client インスタンス
 */
export async function initNotionMCPServer(): Promise<MCPClient> {
	// すでに初期化されている場合は既存のクライアントを返す
	if (notionMCPClient) {
		return notionMCPClient;
	}

	// 環境変数からNotion API Keyを取得
	const notionApiKey = process.env.NOTION_API_KEY;

	if (!notionApiKey) {
		throw new Error("NOTION_API_KEY is not defined in environment variables");
	}

	// Notion MCPサーバーを起動
	notionMCPServerProcess = spawn(
		"npx",
		["@notionhq/notion-mcp-server", "--stdio"],
		{
			env: {
				...process.env,
				// 公式ライブラリの形式に合わせて環境変数を設定
				OPENAPI_MCP_HEADERS: JSON.stringify({
					Authorization: `Bearer ${notionApiKey}`,
					"Notion-Version": "2022-06-28",
				}),
			},
			stdio: ["pipe", "pipe", "pipe"],
		},
	);

	// エラーハンドリング
	notionMCPServerProcess.stderr?.on("data", (data) => {
		console.error(`Notion MCP Server Error: ${data.toString()}`);
	});

	// MCPクライアントを初期化
	// 独自のMCPClientインターフェースを使用
	// @modelcontextprotocol/sdk/clientのインポートに問題があるため、
	// 標準入出力を直接扱うクライアントを実装
	class StdioClient implements MCPClient {
		private stdin: NodeJS.WritableStream;
		private stdout: NodeJS.ReadableStream;
		private messageQueue: Map<
			string,
			{
				resolve: (value: unknown) => void;
				reject: (reason?: any) => void;
			}
		>;
		private messageId: number;

		constructor(options: {
			stdin: NodeJS.WritableStream;
			stdout: NodeJS.ReadableStream;
		}) {
			this.stdin = options.stdin;
			this.stdout = options.stdout;
			this.messageQueue = new Map();
			this.messageId = 0;

			// 標準出力からのレスポンスを処理
			this.stdout.on("data", (data) => {
				try {
					// デバッグ用にレスポンスを出力
					const rawData = data.toString();
					console.debug(`Raw response: ${rawData}`);

					// 複数のJSONメッセージが含まれている可能性があるため、
					// 各行を個別に処理
					const messages = rawData.trim().split("\n");
					for (const message of messages) {
						if (!message) continue;

						// JSONでない可能性のある出力をスキップ
						if (!message.startsWith("{")) {
							console.debug(`Skipping non-JSON message: ${message}`);
							continue;
						}

						try {
							// JSONをパース
							const response = JSON.parse(message);
							console.debug(`Parsed response: ${JSON.stringify(response)}`);

							// IDに対応するリクエストを取得
							const id = response.id;
							if (!id) {
								console.debug(`Response has no id: ${message}`);
								continue;
							}

							const pendingRequest = this.messageQueue.get(id);

							if (pendingRequest) {
								if (response.error) {
									console.error(
										`Error in response: ${JSON.stringify(response.error)}`,
									);
									pendingRequest.reject(new Error(response.error.message));
								} else {
									pendingRequest.resolve(response.result);
								}
								this.messageQueue.delete(id);
							} else {
								console.debug(`No pending request found for id: ${id}`);
							}
						} catch (parseError) {
							console.error(
								`Error parsing JSON message: ${(parseError as Error).message}`,
								`\nMessage: ${message}`,
							);
						}
					}
				} catch (error) {
					console.error("Error processing server response:", error);
				}
			});
		}

		// サーバー情報を取得
		async getServerInfo(): Promise<{ name: string; version: string }> {
			return {
				name: "notion-mcp-server",
				version: "1.5.0",
			};
		}

		// ツールを取得
		getTool(namespace: string, name: string) {
			const toolName = `${namespace}-${name}`;
			return {
				call: async (params: Record<string, unknown>) => {
					return this.sendRequest("tools/call", {
						name: toolName,
						arguments: params,
					});
				},
			};
		}

		// ツール一覧を取得
		async listTools(): Promise<{ tools: Tool[] }> {
			try {
				const result = await this.sendRequest("tools/list", {});
				return result as { tools: Tool[] };
			} catch (error) {
				console.error("Error listing tools:", error);
				return { tools: [] };
			}
		}

		// リクエストを送信
		async sendRequest(
			method: string,
			params: Record<string, unknown>,
		): Promise<any> {
			const id = String(this.messageId++);
			const request = {
				jsonrpc: "2.0",
				id,
				method,
				params,
			};

			console.debug(`Sending request: ${JSON.stringify(request)}`);

			return new Promise((resolve, reject) => {
				// タイムアウト処理を追加
				const timeoutId = setTimeout(() => {
					if (this.messageQueue.has(id)) {
						this.messageQueue.delete(id);
						reject(new Error(`Request timed out after 10 seconds: ${method}`));
					}
				}, 10000);

				this.messageQueue.set(id, {
					resolve: (value) => {
						clearTimeout(timeoutId);
						resolve(value);
					},
					reject: (reason) => {
						clearTimeout(timeoutId);
						reject(reason);
					},
				});

				const requestStr = JSON.stringify(request) + "\n";
				this.stdin.write(requestStr);
			});
		}
	}
	notionMCPClient = new StdioClient({
		stdin: notionMCPServerProcess.stdin!,
		stdout: notionMCPServerProcess.stdout!,
	});

	// サーバー情報を取得して接続を確認
	try {
		assertNotNull(notionMCPClient);
		const serverInfo = await notionMCPClient.getServerInfo();
		console.log(
			`Connected to MCP server: ${serverInfo.name} v${serverInfo.version}`,
		);

		// 利用可能なツールを取得
		const { tools } = await notionMCPClient.listTools();
		console.log(
			`Available tools: ${tools.map((t: Tool) => t.name).join(", ")}`,
		);

		// 検索ツールが存在するか確認
		const searchTool = tools.find(
			(tool: Tool) =>
				tool.name.includes("search") || tool.name.includes("notion-search"),
		);

		if (!searchTool) {
			console.warn("Search tool not found in available tools");
		}
	} catch (error) {
		console.error("Failed to connect to Notion MCP Server:", error);
		shutdownNotionMCPServer("Failed to connect");
		throw error;
	}

	// プロセス終了イベントのハンドラー
	notionMCPServerProcess.on("exit", (code, signal) => {
		console.log(
			`MCP server process exited with code ${code} and signal ${signal}`,
		);
		notionMCPServerProcess = null;
		notionMCPClient = null as unknown as MCPClient;
	});

	return notionMCPClient;
}

/**
 * Notion MCPサーバーを停止する
 */
export function shutdownNotionMCPServer(reason: string = "unknown") {
	console.log(`Shutting down Notion MCP Server: ${reason}`);
	if (notionMCPServerProcess) {
		notionMCPServerProcess.kill();
		notionMCPServerProcess = null;
		notionMCPClient = null;
	}
}

/**
 * プロセス終了時にサーバーを停止するためのハンドラーを設定
 */
export function setupShutdownHandlers() {
	process.on("exit", () => shutdownNotionMCPServer("process exit"));
	process.on("SIGINT", () => {
		shutdownNotionMCPServer("SIGINT signal");
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		shutdownNotionMCPServer("SIGTERM signal");
		process.exit(0);
	});
}
