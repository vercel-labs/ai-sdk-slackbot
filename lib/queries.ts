export const queries = {
  accountByName: `
    SELECT * FROM DWH_PROD.ANALYTICS.ACCOUNTS
    WHERE ACCOUNT_NAME ILIKE ?
    LIMIT 1
  `,

accountBySlackChannel: `
    SELECT * FROM DWH_PROD.ANALYTICS.ACCOUNTS
    WHERE SLACK_CHANNEL_ID = ?
    LIMIT 1
  `,
};
