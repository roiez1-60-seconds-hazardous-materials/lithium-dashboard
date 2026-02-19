export const runtime = "edge";
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

async function askGemini(prompt: string): Promise<string> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" + GEMINI_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
    }
  );
  if (!res.ok) return "ERROR_STATUS_" + res.status;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "EMPTY";
}

async function checkDuplicate(inc: any): Promise<boolean> {
  try {
    const url = SUPABASE_URL + "/rest/v1/incidents?incident_date=eq." + inc.incident_date + "&city=eq." + encodeURIComponent(inc.city) + "&device_type=eq." + encodeURIComponent(inc.device_type) + "&select=id";
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_KEY },
    });
    const existing = await res.json();
    if (Array.isArray(existing) && existing.length > 0) return true;
    const date = new Date(inc.incident_date);
    const before = new Date(date); before.setDate(before.getDate() - 3);
    const after = new Date(date); after.setDate(after.getDate() + 3);
    const fuzzyUrl = SUPABASE_URL + "/rest/v1/incidents?incident_date=gte." + before.toISOString().split("T")[0] + "&incident_date=lte." + after.toISOString().split("T")[0] + "&city=eq." + encodeURIComponent(inc.city) + "&device_type=eq." + encodeURIComponent(inc.device_type) + "&select=id";
    const fuzzyRes = await fetch(fuzzyUrl, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: "Bearer " + SUPABASE_SERVICE_KEY },
    });
    const fuzzyExisting = await fuzzyRes.json();
    return Array.isArray(fuzzyExisting) && fuzzyExisting.length > 0;
  } catch { return false; }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const debug = url.searchParams.get("debug") === "1";
  const year = yearParam ? parseInt(yearParam) : 2024;

  const halves = [
    { label: "first", months: "ינואר, פברואר, מרץ, אפריל, מאי, יוני" },
    { label: "second", months: "יולי, אוגוסט, ספטמבר, אוקטובר, נובמבר, דצמבר" },
  ];

  var allResults: any[] = [];
  var totalInserted = 0;
  var totalDuplicates = 0;
  var debugInfoArr: any[] = [];

  for (var i = 0; i < halves.length; i++) {
    var half = halves[i];
    var prompt = "רשום אירועי שריפה, התלקחות או פיצוץ של סוללות ליתיום שקרו בישראל בחודשים " + half.months + " " + year + ". כלול: שריפות אופניים חשמליים, קורקינטים, רכבים חשמליים, קלנועיות, טלפונים, פאוורבנקים, UPS. לא לכלול: תאונות דרכים רגילות, גניבות, חקיקה. רק אירועים אמיתיים שדווחו בתקשורת הישראלית! החזר JSON array בלבד בלי markdown בלי backticks: [{\"incident_date\":\"YYYY-MM-DD\",\"city\":\"עיר\",\"district\":\"דן/מרכז/חוף/ירושלים/דרום/צפון\",\"device_type\":\"אופניים חשמליים\",\"severity\":\"חמור\",\"injuries\":0,\"fatalities\":0,\"property_damage\":true,\"description\":\"תיאור קצר\",\"source_name\":\"ynet\",\"source_url\":\"\"}]";

    var raw = await askGemini(prompt);

    if (debug) {
      debugInfoArr.push({ year: year, half: half.label, raw_response: raw.substring(0, 1500) });
    }

    try {
      var cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      var jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      var incidents = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(incidents)) continue;

      for (var j = 0; j < incidents.length; j++) {
        var inc = incidents[j];
        if (!inc.incident_date || !inc.city || !inc.device_type) continue;
        var isDup = await checkDuplicate(inc);
        if (isDup) { totalDuplicates++; continue; }

        var row = {
          incident_date: inc.incident_date,
          city: inc.city,
          district: inc.district || "אחר",
          device_type: inc.device_type,
          severity: inc.severity || "בינוני",
          injuries: inc.injuries || 0,
          fatalities: inc.fatalities || 0,
          property_damage: inc.property_damage !== false,
          description: inc.description || "",
          source_name: inc.source_name || "",
          source_url: inc.source_url || "",
          data_source: "archive_scan",
          gemini_confidence: 0.7,
          verified: false,
        };

        var insertRes = await fetch(SUPABASE_URL + "/rest/v1/incidents", {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: "Bearer " + SUPABASE_SERVICE_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(row),
        });
        if (insertRes.ok) totalInserted++;
      }

      allResults.push({ year: year, half: half.label, found: incidents.length });
    } catch (e: any) {
      allResults.push({ year: year, half: half.label, error: e.message });
    }

    await new Promise(function(r) { setTimeout(r, 1000); });
  }

  var result: any = {
    status: "ok",
    year: year,
    total_inserted: totalInserted,
    total_duplicates: totalDuplicates,
    details: allResults,
    duration_ms: Date.now() - startTime,
  };

  if (debug) {
    result.debug = debugInfoArr;
  }

  return Response.json(result);
}
