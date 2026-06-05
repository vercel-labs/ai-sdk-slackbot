export interface SlackRuntimeContext {
  channelId: string;
  userId: string | undefined;
}

export function runtimeContextFromEvent(event: {
  channel: string;
  user?: string;
}): SlackRuntimeContext {
  return {
    channelId: event.channel,
    userId: event.user,
  };
}
