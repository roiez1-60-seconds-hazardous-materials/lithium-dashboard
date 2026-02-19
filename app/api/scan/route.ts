// app/api/scan/route.ts
// Scans Israeli news for lithium battery fire incidents using Gemini AI
// Stores verified incidents in Supabase
// Triggered by Vercel Cron every 6 hours

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

// Israeli news RSS feeds
const RSS_FEEDS = [
  "https://www.ynet.co.il/Integration/StoryRss2.xml",
  "https://rss.walla.co.il/feed/1",
  "https://www.maariv.co.il/Rss/RssFeedsMivzakChadashot",
  "https://www.israelhayom.co.il/rss",
  "https://www.calcalist.co.il/GeneralRss/0,16335,L-8,00.xml",
];

// Keywords to pre-filter
const KEYWORDS = [
  "סוללת ליתיום", "ליתיום", "אופניים חשמליים",
  "קורקינט חשמלי", "קורקינט", "רכב חשמלי", "קלנועית",
  "סוללה התלקחה", "סוללה התפוצצה", "התלקחות סוללה", "פיצוץ סוללה",
  "טעינת סוללה", "בריחה תרמית",
  "פאוורבנק", "UPS", "מתקן אגירה",
];

async function fetchRSS(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();

    const items: string[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || "";
      const desc = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1] || "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      const combined = `${title} ${desc}`.toLowerCase();
      // Check if any keyword matches AND has fire-related word
      const hasKeyword = KEYWORDS.some(kw => combined.includes(kw));
      const hasFire = ["שריפ", "התלקח", "התפוצצ", "בוער", "בער", "נדלק", "עלה באש", "אש ", "להבות", "פיצוץ"].some(fw => combined.includes(fw));

      if (hasKeyword && hasFire) {
        items.push(JSON.stringify({ title, desc: desc.substring(0, 500), link, pubDate }));
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function analyzeWithGemini(articles: string[]): Promise<any[]> {
  const prompt = `אתה מנתח חדשות שריפות סוללות ליתיום בישראל עבור מסד נתונים של כבאות והצלה.

כללים:
1. כלול רק: שריפה/פיצוץ/התלקחות של סוללת ליתיום יון
2. סוגי מכשירים: אופניים חשמליים, קורקינט חשמלי, רכב חשמלי, טלפון נייד, מחשב נייד, UPS/גיבוי, סוללת כוח, כלי עבודה, אחר
3. לא לכלול: תאונת דרכים רגילה (אלא אם הסוללה עצמה נדלקה), גניבה, מכירות, חקיקה, כתבות כלליות על ליתיום
4. מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום
5. חומרה: קל (נזק מינורי), בינוני (נזק רכוש), חמור (פצועים/נזק גדול), קריטי (הרוגים/נזק חמור)

עבור כל אירוע, החזר:
{
  "incident_date": "YYYY-MM-DD",
  "city": "שם העיר בעברית",
  "district": "שם המחוז",
  "device_type": "סוג המכשיר (מהרשימה למעלה)",
  "severity": "קל/בינוני/חמור/קריטי",
  "injuries": 0,
  "fatalities": 0,
  "property_damage": true,
  "description": "תיאור קצר בעברית, עד 200 תווים",
  "source_name": "שם האתר",
  "source_url": "קישור לכתבה"
}

הכתבות:
${articles.join("\n\n")}

החזר JSON array בלבד. אם אין אירועים רלוונטיים החזר [].`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

async function checkDuplicate(inc: any): Promise<boolean> {
  try {
    // Check: same date + same city + same device_type
    const url = `${SUPABASE_URL}/rest/v1/incidents?incident_date=eq.${inc.incident_date}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const existing = await res.json();
    if (Array.isArray(existing) && existing.length > 0) return true;

    // Also check ±3 days same city same device (fuzzy dedup)
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

async function insertToSupabase(incidents: any[]): Promise<number> {
  if (!incidents.length) return 0;

  let inserted = 0;
  for (const inc of incidents) {
    try {
      if (!inc.incident_date || !inc.city || !inc.device_type) continue;

      const isDup = await checkDuplicate(inc);
      if (isDup) continue;

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
        data_source: "gemini_scan",
        gemini_confidence: 0.8,
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

      if (res.ok) inserted++;
    } catch {
      continue;
    }
  }
  return inserted;
}

async function logScan(articlesFound: number, incidentsAdded: number, errors: string | null, durationMs: number) {
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
        articles_found: articlesFound,
        incidents_added: incidentsAdded,
        errors,
        duration_ms: durationMs,
      }),
    });
  } catch {}
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret (optional security)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without secret for manual testing, but log it
    console.log("Scan triggered without cron secret");
  }

  try {
    // 1. Fetch all RSS feeds in parallel
    const feedResults = await Promise.all(RSS_FEEDS.map(fetchRSS));
    const allArticles = feedResults.flat();

    if (allArticles.length === 0) {
      const duration = Date.now() - startTime;
      await logScan(0, 0, null, duration);
      return Response.json({
        status: "ok",
        message: "No relevant articles found in RSS feeds",
        scanned: 0,
        detected: 0,
        inserted: 0,
        duration_ms: duration,
      });
    }

    // 2. Analyze with Gemini (batch up to 10)
    const allIncidents: any[] = [];
    for (let i = 0; i < allArticles.length; i += 10) {
      const batch = allArticles.slice(i, i + 10);
      const incidents = await analyzeWithGemini(batch);
      allIncidents.push(...incidents);
    }

    // 3. Insert to Supabase with dedup
    const inserted = await insertToSupabase(allIncidents);

    const duration = Date.now() - startTime;
    await logScan(allArticles.length, inserted, null, duration);

    return Response.json({
      status: "ok",
      scanned: allArticles.length,
      detected: allIncidents.length,
      inserted,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    const duration = Date.now() - startTime;
    await logScan(0, 0, e.message, duration);
    return Response.json({ status: "error", message: e.message, duration_ms: duration }, { status: 500 });
  }
}
