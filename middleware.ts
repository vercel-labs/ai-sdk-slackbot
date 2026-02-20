export default async function middleware(request: Request) {
  const PREVIEW_URL = process.env.PREVIEW_URL;
  if (!PREVIEW_URL) return;

  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);

  // Only intercept if the message contains the --preview flag
  if (!payload.event?.text?.includes("--preview")) return;

  // Forward the full request to the preview environment
  try {
    await fetch(`${PREVIEW_URL}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Slack-Request-Timestamp":
          request.headers.get("X-Slack-Request-Timestamp") || "",
        "X-Slack-Signature":
          request.headers.get("X-Slack-Signature") || "",
      },
      body: rawBody,
    });
    return new Response("Forwarded to preview", { status: 200 });
  } catch (error) {
    return new Response("Preview forwarding failed", { status: 502 });
  }
}

export const config = {
  matcher: "/api/events",
  runtime: "nodejs",
};
