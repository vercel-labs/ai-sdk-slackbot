import { lookupAccountBySlackChannel, lookupAccountByChannelName } from "../lib/salesforce-lookup";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const channelName = url.searchParams.get('channelName');

    if (!channelId && !channelName) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Either channelId or channelName query parameter is required',
        examples: [
          '/api/test-salesforce-lookup?channelId=C07VCNCPGPR',
          '/api/test-salesforce-lookup?channelName=shared-acmecorp'
        ]
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let accountInfo;
    if (channelName) {
      console.log('[test-salesforce-lookup] Testing name fallback for channel:', channelName);
      accountInfo = await lookupAccountByChannelName(channelName);
    } else {
      console.log('[test-salesforce-lookup] Testing lookup for channel:', channelId);
      accountInfo = await lookupAccountBySlackChannel(channelId!);
    }

    if (!accountInfo) {
      return new Response(JSON.stringify({
        success: false,
        message: channelName
          ? `No Salesforce account found for channel name: ${channelName}`
          : `No Salesforce account found for channel: ${channelId}`,
        ...(channelId ? { channelId } : { channelName })
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Account found successfully',
      ...(channelId ? { channelId } : { channelName }),
      accountInfo
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[test-salesforce-lookup] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error during lookup',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
