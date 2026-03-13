import snowflake, { Connection } from 'snowflake-sdk';
import { queries } from './queries';

interface SalesforceAccount {
  [key: string]: any; // Salesforce returns all account properties
}

function createSnowflakeConnection(): Connection {
  return snowflake.createConnection({
    username: process.env.SNOWFLAKE_USERNAME || '',
    password: process.env.SNOWFLAKE_TOKEN || '',
    database: process.env.SNOWFLAKE_DATABASE || '',
    account: process.env.SNOWFLAKE_DATA_ACCOUNT || '',
    warehouse: process.env.SNOWFLAKE_DATA_WAREHOUSE || '',
    role: process.env.SNOWFLAKE_DATA_ROLE || '',
  });
}

async function executeQuery<T = any>(
  connection: Connection,
  sqlText: string,
  binds?: (string | number | boolean | null)[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err: Error | undefined, stmt: unknown, rows: T[] | undefined) => {
        if (err) {
          console.error('[salesforce-lookup] Failed to execute statement:', err.message);
          reject(err);
        } else {
          console.log('[salesforce-lookup] Successfully executed statement');
          resolve(rows || []);
        }
      }
    });
  });
}

export async function lookupAccountByChannelName(channelName: string): Promise<SalesforceAccount | null> {
  let connection: Connection | null = null;

  try {
    // Strip shared- or enterprise- prefix to get the customer name token
    const customerName = channelName.replace(/^(shared|enterprise)-/i, '');
    console.log('[salesforce-lookup] Channel name fallback:', channelName, '→', customerName);

    connection = createSnowflakeConnection();

    await new Promise<void>((resolve, reject) => {
      connection!.connect((err: Error | undefined) => {
        if (err) {
          console.error('[salesforce-lookup] Unable to connect:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const bindPattern = `%${customerName}%`;

    const accountResult = await executeQuery<SalesforceAccount>(connection, queries.accountByName, [bindPattern]);

    if (!accountResult || accountResult.length === 0) {
      console.log('[salesforce-lookup] No account found for channel name:', channelName);
      return null;
    }

    console.log('[salesforce-lookup] Found account via name fallback:', accountResult[0]?.ACCOUNT_NAME || accountResult[0]?.NAME || accountResult[0]?.ID);
    return accountResult[0];

  } catch (error) {
    console.error('[salesforce-lookup] Error during name fallback lookup:', error);
    return null;
  } finally {
    if (connection) {
      connection.destroy((err: Error | undefined) => {
        if (err) {
          console.error('[salesforce-lookup] Unable to disconnect:', err.message);
        }
      });
    }
  }
}

export async function lookupAccountBySlackChannel(slackChannelId: string): Promise<SalesforceAccount | null> {
  let connection: Connection | null = null;

  try {
    console.log('[salesforce-lookup] Looking up Slack channel:', slackChannelId);

    // Create Snowflake connection
    connection = createSnowflakeConnection();

    // Connect to Snowflake
    await new Promise<void>((resolve, reject) => {
      connection!.connect((err: Error | undefined) => {
        if (err) {
          console.error('[salesforce-lookup] Unable to connect:', err.message);
          reject(err);
        } else {
          console.log('[salesforce-lookup] Successfully connected to Snowflake');
          resolve();
        }
      });
    });

    const accountResult = await executeQuery<SalesforceAccount>(connection, queries.accountBySlackChannel, [slackChannelId]);

    if (!accountResult || accountResult.length === 0) {
      console.log('[salesforce-lookup] No account found for channel:', slackChannelId);
      return null;
    }

    console.log('[salesforce-lookup] Found account:', accountResult[0]?.NAME || accountResult[0]?.ID);
    return accountResult[0];

  } catch (error) {
    console.error('[salesforce-lookup] Error during lookup:', error);
    return null;
  } finally {
    // Always clean up the connection
    if (connection) {
      connection.destroy((err: Error | undefined) => {
        if (err) {
          console.error('[salesforce-lookup] Unable to disconnect:', err.message);
        } else {
          console.log('[salesforce-lookup] Disconnected from Snowflake');
        }
      });
    }
  }
}
