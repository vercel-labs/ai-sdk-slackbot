/**
 * ThinkingStreamManager - Manages Slack thinking traces using native streaming API
 *
 * Uses chat.startStream, chat.appendStream, and chat.stopStream APIs to show
 * real-time task progress with native Slack UI rendering.
 *
 * Design: Single parent task with title showing current action.
 * During streaming: Only update parent task title (no child tasks).
 * On stop: Send parent task + child tasks together for nested display.
 * Uses deduplication to prevent repeated steps.
 */

import type { WebClient } from "@slack/web-api";
import {
  startStream,
  appendStream,
  stopStream,
  type TaskUpdateChunk,
} from "./thinking-stream";

interface ThinkingStreamManagerOptions {
  client: WebClient;
  channel: string;
  threadTs: string;
  recipientUserId: string;
  recipientTeamId: string;
}

interface CompletedStep {
  id: string;
  title: string;
}

export class ThinkingStreamManager {
  private client: WebClient;
  private channel: string;
  private threadTs: string;
  private recipientUserId: string;
  private recipientTeamId: string;

  private streamTs: string | null = null;
  private parentTaskId: string;
  private currentTitle = "Thinking...";
  private lastUpdateTime = 0;
  private pendingUpdate: NodeJS.Timeout | null = null;
  private disabled = false;
  private consecutiveFailures = 0;
  private updateNeeded = false;

  private completedSteps: CompletedStep[] = [];
  private completedStepTitles = new Set<string>();
  private stepIdCounter = 0;

  private currentToolName: string | null = null;
  private currentToolInput: unknown = null;

  private readonly MIN_UPDATE_INTERVAL = 500;
  private readonly MAX_FAILURES = 3;
  private readonly MAX_DISPLAYED_STEPS = 6;

  constructor(options: ThinkingStreamManagerOptions) {
    this.client = options.client;
    this.channel = options.channel;
    this.threadTs = options.threadTs;
    this.recipientUserId = options.recipientUserId;
    this.recipientTeamId = options.recipientTeamId;
    this.parentTaskId = this.generateId("parent");
  }

  async start(): Promise<void> {
    try {
      this.streamTs = await startStream(this.client, {
        channel: this.channel,
        thread_ts: this.threadTs,
        recipient_user_id: this.recipientUserId,
        recipient_team_id: this.recipientTeamId,
        task_display_mode: "plan",
        chunks: [
          {
            type: "task_update",
            id: this.parentTaskId,
            title: "Thinking...",
            status: "in_progress",
          },
        ],
      });
    } catch (error) {
      console.error("[ThinkingStreamManager] Failed to start:", error);
      this.disabled = true;
    }
  }

  addToolStart(toolName: string, input: unknown): void {
    this.currentToolName = toolName;
    this.currentToolInput = input;
    this.currentTitle = this.formatToolTitle(toolName, input);
    this.updateNeeded = true;
    this.scheduleUpdate();
  }

  completeCurrentTool(output: unknown): void {
    if (!this.currentToolName) return;

    const completedTitle = this.formatCompletedTitle(
      this.currentToolName,
      this.currentToolInput,
      output,
    );

    if (!this.completedStepTitles.has(completedTitle)) {
      this.completedStepTitles.add(completedTitle);
      this.completedSteps.push({
        id: this.generateId("step"),
        title: completedTitle,
      });
    }

    this.currentToolName = null;
    this.currentToolInput = null;
  }

  errorCurrentTool(error: string): void {
    if (this.currentToolName) {
      const errorTitle = `Error: ${this.truncate(error, 40)}`;
      if (!this.completedStepTitles.has(errorTitle)) {
        this.completedStepTitles.add(errorTitle);
        this.completedSteps.push({
          id: this.generateId("step"),
          title: errorTitle,
        });
      }
      this.currentTitle = errorTitle;
      this.updateNeeded = true;
      this.scheduleUpdate();
    }
    this.currentToolName = null;
    this.currentToolInput = null;
  }

  async stop(finalText?: string): Promise<void> {
    if (!this.streamTs || this.disabled) return;
    this.disabled = true;

    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    const chunks: TaskUpdateChunk[] = [];

    chunks.push({
      type: "task_update",
      id: this.parentTaskId,
      title: "Thinking completed",
      status: "complete",
    });

    const recentSteps = this.completedSteps.slice(-this.MAX_DISPLAYED_STEPS);
    for (const step of recentSteps) {
      chunks.push({
        type: "task_update",
        id: step.id,
        title: step.title,
        status: "complete",
      });
    }

    try {
      await stopStream(this.client, {
        channel: this.channel,
        ts: this.streamTs,
        chunks,
        ...(finalText ? { markdown_text: finalText } : {}),
      });
    } catch (error) {
      console.error("[ThinkingStreamManager] Failed to stop:", error);
    }
  }

  async stopWithError(error: unknown): Promise<void> {
    if (!this.streamTs || this.disabled) return;
    this.disabled = true;

    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }

    const reason = error instanceof Error ? error.message : String(error);
    const shortReason = this.truncate(reason, 90);
    const currentAction =
      this.currentToolName !== null
        ? this.formatToolTitle(this.currentToolName, this.currentToolInput)
        : null;

    const chunks: TaskUpdateChunk[] = [
      {
        type: "task_update",
        id: this.parentTaskId,
        title: `Failed to complete request - ${shortReason}`,
        status: "error",
        details: reason,
      },
    ];

    if (currentAction) {
      chunks.push({
        type: "task_update",
        id: this.generateId("step"),
        title: `${currentAction} - ${shortReason}`,
        status: "error",
        details: reason,
      });
    }

    const recentSteps = this.completedSteps.slice(
      -Math.max(0, this.MAX_DISPLAYED_STEPS - 1),
    );
    for (const step of recentSteps) {
      chunks.push({
        type: "task_update",
        id: step.id,
        title: step.title,
        status: "complete",
      });
    }

    try {
      await stopStream(this.client, {
        channel: this.channel,
        ts: this.streamTs,
        chunks,
      });
    } catch (stopError) {
      console.error(
        "[ThinkingStreamManager] Failed to stop with error:",
        stopError,
      );
    }
  }

  cleanup(): void {
    if (this.pendingUpdate) {
      clearTimeout(this.pendingUpdate);
      this.pendingUpdate = null;
    }
  }

  private generateId(prefix: string): string {
    this.stepIdCounter++;
    return `${prefix}_${Date.now()}_${this.stepIdCounter}`;
  }

  private scheduleUpdate(): void {
    if (this.disabled || !this.streamTs || this.pendingUpdate) return;

    const elapsed = Date.now() - this.lastUpdateTime;
    if (elapsed >= this.MIN_UPDATE_INTERVAL) {
      void this.doUpdate();
    } else {
      this.pendingUpdate = setTimeout(() => {
        this.pendingUpdate = null;
        void this.doUpdate();
      }, this.MIN_UPDATE_INTERVAL - elapsed);
    }
  }

  private async doUpdate(): Promise<void> {
    if (this.disabled || !this.streamTs || !this.updateNeeded) return;

    this.updateNeeded = false;
    this.lastUpdateTime = Date.now();

    try {
      await appendStream(this.client, {
        channel: this.channel,
        ts: this.streamTs,
        chunks: [
          {
            type: "task_update",
            id: this.parentTaskId,
            title: this.currentTitle,
            status: "in_progress",
          },
        ],
      });
      this.consecutiveFailures = 0;
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      if (err?.data?.error === "message_not_found") {
        this.disabled = true;
        return;
      }
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_FAILURES) {
        this.disabled = true;
      }
    }
  }

  private formatToolTitle(toolName: string, input: unknown): string {
    switch (toolName) {
      case "searchChannelHistory":
        return `Searching channel history for "${this.truncate(
          (input as { searchQuery?: string })?.searchQuery ?? "",
          30,
        )}"`;
      case "createTicket":
        return `Creating DSE ticket`;
      default:
        return toolName;
    }
  }

  private formatCompletedTitle(
    toolName: string,
    input: unknown,
    _output: unknown,
  ): string {
    switch (toolName) {
      case "searchChannelHistory":
        return `Searched channel history for "${this.truncate(
          (input as { searchQuery?: string })?.searchQuery ?? "",
          30,
        )}"`;
      case "createTicket":
        return `Created DSE ticket`;
      default:
        return toolName;
    }
  }

  private truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n - 1) + "…";
  }
}
