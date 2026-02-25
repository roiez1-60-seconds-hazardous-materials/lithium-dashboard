import { getSupabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Get recent search runs
    const { data: searchRuns } = await supabase
      .from("search_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);

    // Get last successful scan
    const { data: lastScan } = await supabase
      .from("search_runs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1);

    const lastUpdate = lastScan?.[0]?.completed_at || null;

    // Get daily stats if table exists
    let dailyStats = [];
    try {
      const { data } = await supabase
        .from("daily_stats")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);
      dailyStats = data || [];
    } catch (e) {
      // Table may not exist
    }

    return Response.json({
      searchRuns: searchRuns || [],
      lastUpdate,
      dailyStats,
      systemStatus: "active",
    });
  } catch (e) {
    return Response.json(
      { searchRuns: [], lastUpdate: null, dailyStats: [], systemStatus: "error", error: e.message },
      { status: 200 }
    );
  }
}
