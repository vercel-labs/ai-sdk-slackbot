import { resolveChannelName } from "../slack-utils";

export interface SlackRuntimeContext {
  channelId: string;
  channelName: string | undefined;
  userId: string | undefined;
}

export async function runtimeContextFromEvent(event: {
  channel: string;
  user?: string;
}): Promise<SlackRuntimeContext> {
  return {
    channelId: event.channel,
    channelName: await resolveChannelName(event.channel),
    userId: event.user,
  };
}
