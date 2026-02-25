import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "500");

    const { data, error } = await supabase
      .from("incidents")
      .select("id, incident_date, city, district, device_type, severity, fatalities, injuries, description, source_name, source_url, verified, data_source")
      .order("incident_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ incidents: data || [] });
  } catch (err) {
    console.error("API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
