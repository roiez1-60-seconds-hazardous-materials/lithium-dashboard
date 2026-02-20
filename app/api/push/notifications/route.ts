// app/api/push/notifications/route.ts
export const runtime = "edge";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?order=sent_at.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      return Response.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const notifications = await res.json();
    return Response.json(notifications);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
