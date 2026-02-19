// app/api/scan-archive/route.ts
// One-time archive scan — finds real historical lithium battery fire incidents
// using Gemini AI to search Israeli news archives year by year
// Usage: GET /api/scan-archive?year=2023 (or no param for all years)

export const runtime = "edge";
export const maxDuration = 300; // 5 minutes for archive scanning

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

async function searchWithGemini(year: number, half: string): Promise<any[]> {
  const months = half === "first" 
    ? ["ינואר","פברואר","מרץ","אפריל","מאי","יוני"] 
    : ["יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

  const prompt = `רשום את כל אירועי שריפה, התלקחות או פיצוץ של סוללות ליתיום שקרו בישראל בחודשים ${months.join(", ")} ${year}.

אירועים ידועים שדווחו בתקשורת הישראלית (ynet, כלכליסט, הארץ, וואלה, מעריב, מאקו, חי פה, חדשות 13, חדשות 12, כבאות והצלה).

כלול: שריפות אופניים חשמליים, קורקינטים, רכבים חשמליים (שהסוללה נדלקה), קלנועיות, טלפונים, פאוורבנקים, UPS.
לא לכלול: תאונות דרכים רגילות, גניבות, חקיקה, כתבות כלליות.

חשוב: ציין רק אירועים שאתה בטוח שקרו! אם אתה יודע על אירוע אמיתי — כלול אותו עם התאריך המדויק ככל הניתן.

החזר JSON array:
[{
  "incident_date": "YYYY-MM-DD",
  "city": "עיר בעברית",
  "district": "צפון/חוף/דן/מרכז/ירושלים/יו״ש/דרום",
  "device_type": "אופניים חשמליים/קורקינט חשמלי/רכב חשמלי/טלפון נייד/מחשב נייד/UPS/גיבוי/סוללת כוח/כלי עבודה/אחר",
  "severity": "קל/בינוני/חמור/קריטי",
  "injuries": 0,
  "fatalities": 0,
  "property_damage": true,
  "description": "תיאור קצר בעברית",
  "source_name": "שם המקור",
  "source_url": ""
}]

מיפוי מחוזות: דן=תל אביב/רמת גן/בני ברק/חולון/בת ים/פתח תקווה/הרצליה, מרכז=ראשון לציון/רחובות/לוד/רמלה/מודיעין, חוף=חיפה/נתניה/חדרה/עכו/נהריה, ירושלים=ירושלים/בית שמש, דרום=באר שבע/אשדוד/אשקלון/אילת, צפון=טבריה/נצרת/עפולה/כרמיאל/צפת

החזר רק JSON array, בלי טקסט נוסף, בלי markdown.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || "")
      .join("") || "[]";

    // Clean markdown fences if present
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Error scanning ${year} ${half}:`, e);
    return [];
  }
}

async function checkDuplicate(inc: any): Promise<boolean> {
  try {
    // Exact match: same date + city + device_type
    const url = `${SUPABASE_URL}/rest/v1/incidents?incident_date=eq.${inc.incident_date}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const existing = await res.json();
    if (Array.isArray(existing) && existing.length > 0) return true;

    // Fuzzy: ±3 days same city
    const date = new Date(inc.incident_date);
    const before = new Date(date); before.setDate(before.getDate() - 3);
    const after = new Date(date); after.setDate(after.getDate() + 3);
    const fuzzyUrl = `${SUPABASE_URL}/rest/v1/incidents?incident_date=gte.${before.toISOString().split("T")[0]}&incident_date=lte.${after.toISOString().split("T")[0]}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const fuzzyRes = await fetch(fuzzyUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const fuzzyExisting = await fuzzyRes.json();
    return Array.isArray(fuzzyExisting) && fuzzyExisting.length > 0;
  } catch {
    return false;
  }
}

async function insertIncident(inc: any): Promise<boolean> {
  try {
    if (!inc.incident_date || !inc.city || !inc.device_type) return false;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(inc.incident_date)) return false;

    const isDup = await checkDuplicate(inc);
    if (isDup) return false;

    const row = {
      incident_date: inc.incident_date,
      city: inc.city,
      district: inc.district || "אחר",
      device_type: inc.device_type,
      severity: inc.severity || "בינוני",
      injuries: inc.injuries || 0,
      fatalities: inc.fatalities || 0,
      property_damage: inc.property_damage ?? true,
      description: inc.description || "",
      source_name: inc.source_name || "",
      source_url: inc.source_url || "",
      data_source: "archive_scan",
      gemini_confidence: 0.7,
      verified: false,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/incidents`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  // Determine which years to scan
  const currentYear = new Date().getFullYear();
  const years = yearParam
    ? [parseInt(yearParam)]
    : Array.from({ length: currentYear - 2019 + 1 }, (_, i) => 2019 + i);

  const results: any[] = [];
  let totalDetected = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (const year of years) {
    for (const half of ["first", "second"] as const) {
      // Skip future half-years
      if (year === currentYear && half === "second" && new Date().getMonth() < 6) continue;

      try {
        const incidents = await searchWithGemini(year, half);
        totalDetected += incidents.length;

        let yearInserted = 0;
        let yearDuplicates = 0;

        for (const inc of incidents) {
          const ok = await insertIncident(inc);
          if (ok) {
            yearInserted++;
            totalInserted++;
          } else {
            yearDuplicates++;
            totalDuplicates++;
          }
        }

        results.push({
          year,
          half,
          found: incidents.length,
          inserted: yearInserted,
          duplicates: yearDuplicates,
        });

        // Small delay between API calls to avoid rate limiting
        await new Promise(r => setTimeout(r, 1000));
      } catch (e: any) {
        results.push({ year, half, error: e.message });
      }
    }
  }

  // Log the scan
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/scan_log`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        articles_found: totalDetected,
        incidents_added: totalInserted,
        errors: `archive_scan: years=${years.join(",")}`,
        duration_ms: Date.now() - startTime,
      }),
    });
  } catch {}

  return Response.json({
    status: "ok",
    type: "archive_scan",
    years_scanned: years,
    total_detected: totalDetected,
    total_inserted: totalInserted,
    total_duplicates: totalDuplicates,
    details: results,
    duration_ms: Date.now() - startTime,
  });
}
