// app/api/push/subscribe/route.ts
// Handles push notification subscription from the dashboard

export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint) {
      return Response.json({ error: "Missing endpoint" }, { status: 400 });
    }

    // Upsert subscriber
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscribers`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        endpoint,
        keys_p256dh: keys?.p256dh || null,
        keys_auth: keys?.auth || null,
        user_agent: request.headers.get("user-agent") || "",
        last_active: new Date().toISOString(),
        active: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }

    return Response.json({ status: "subscribed" });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Unsubscribe
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return Response.json({ error: "Missing endpoint" }, { status: 400 });
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscribers?endpoint=eq.${encodeURIComponent(endpoint)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ active: false }),
      }
    );

    return Response.json({ status: "unsubscribed" });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
