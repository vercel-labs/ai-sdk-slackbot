export const queries = {
  accountByName: `
    SELECT * FROM DWH_PROD.ANALYTICS.ACCOUNTS
    WHERE ACCOUNT_NAME ILIKE ?
    LIMIT 1
  `,

accountBySlackChannel: (slackChannelId: string) => `
    SELECT * FROM DWH_PROD.ANALYTICS.ACCOUNTS
    WHERE SLACK_CHANNEL_ID = '${slackChannelId}'
    LIMIT 1
  `,
};
