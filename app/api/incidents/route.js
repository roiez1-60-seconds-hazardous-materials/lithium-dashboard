import { getSupabaseAdmin } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "200");
    const year = url.searchParams.get("year");
    const device = url.searchParams.get("device");

    let query = supabase
      .from("incidents")
      .select("*")
      .order("incident_date", { ascending: false })
      .limit(limit);

    if (year) {
      query = query
        .gte("incident_date", `${year}-01-01`)
        .lte("incident_date", `${year}-12-31`);
    }
    if (device) {
      query = query.eq("device_type", device);
    }

    const { data: incidents, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats
    const totalIncidents = incidents.length;
    const totalDeaths = incidents.reduce((sum, i) => sum + (i.deaths || 0), 0);
    const totalInjuries = incidents.reduce((sum, i) => sum + (i.injuries || 0), 0);

    // Device breakdown
    const deviceCounts = {};
    incidents.forEach((i) => {
      const d = i.device_type || "אחר";
      deviceCounts[d] = (deviceCounts[d] || 0) + 1;
    });

    // Yearly breakdown
    const yearlyCounts = {};
    incidents.forEach((i) => {
      const y = i.incident_date ? new Date(i.incident_date).getFullYear() : "unknown";
      yearlyCounts[y] = (yearlyCounts[y] || 0) + 1;
    });

    // Monthly breakdown (current year)
    const currentYear = new Date().getFullYear();
    const monthlyCounts = {};
    incidents
      .filter((i) => i.incident_date && new Date(i.incident_date).getFullYear() === currentYear)
      .forEach((i) => {
        const m = new Date(i.incident_date).getMonth() + 1;
        monthlyCounts[m] = (monthlyCounts[m] || 0) + 1;
      });

    // City breakdown (top 10)
    const cityCounts = {};
    incidents.forEach((i) => {
      const c = i.city || "לא ידוע";
      cityCounts[c] = (cityCounts[c] || 0) + 1;
    });
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Severity breakdown
    const severityCounts = {};
    incidents.forEach((i) => {
      const s = i.severity || "בינונית";
      severityCounts[s] = (severityCounts[s] || 0) + 1;
    });

    return Response.json({
      incidents,
      stats: {
        totalIncidents,
        totalDeaths,
        totalInjuries,
        deviceCounts,
        yearlyCounts,
        monthlyCounts,
        topCities,
        severityCounts,
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
