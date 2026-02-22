// app/api/scan-archive/route.ts
// V3 — Deep archive scanner for past lithium battery fire incidents
// Sources: Google News (date-filtered), Telegram history, Gemini knowledge
// Usage: /api/scan-archive?year=2025 or /api/scan-archive?year=2025&month=6
// Also: /api/scan-archive?from=2024-01-01&to=2024-12-31

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

// ============================================
// Google News archive search (date-filtered)
// ============================================
async function searchGoogleNewsArchive(query: string, dateAfter: string, dateBefore: string): Promise<string[]> {
  const items: string[] = [];
  try {
    // Google News RSS supports date filtering via after: and before: in query
    const fullQuery = `${query}+after:${dateAfter}+before:${dateBefore}`;
    const url = `https://news.google.com/rss/search?q=${fullQuery}&hl=he&gl=IL&ceid=IL:he`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const text = await res.text();

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      const sourceName = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "Google News";

      if (title.length > 10) {
        items.push(JSON.stringify({ title, desc: title, link, pubDate, source: `google_archive (${sourceName})` }));
      }
    }
  } catch {}
  return items;
}

// ============================================
// Telegram archive search (scroll back)
// ============================================
async function searchTelegramArchive(channel: string, query: string): Promise<string[]> {
  const items: string[] = [];
  try {
    // Telegram public channel search via t.me/s/
    const url = `https://t.me/s/${channel}?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract messages
    const msgRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    // Extract dates
    const dateRegex = /<time[^>]*datetime="([^"]*)"[^>]*>/gi;
    const dates: string[] = [];
    let dateMatch;
    while ((dateMatch = dateRegex.exec(html)) !== null) {
      dates.push(dateMatch[1]);
    }

    let msgMatch;
    let msgIndex = 0;
    while ((msgMatch = msgRegex.exec(html)) !== null) {
      const text = msgMatch[1]
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();

      if (text.length > 20) {
        items.push(JSON.stringify({
          title: text.substring(0, 200),
          desc: text.substring(0, 500),
          link: `https://t.me/s/${channel}`,
          pubDate: dates[msgIndex] || new Date().toISOString(),
          source: `telegram_archive (@${channel})`,
        }));
      }
      msgIndex++;
    }
  } catch {}
  return items;
}

// ============================================
// Gemini knowledge-based search (fallback)
// ============================================
async function askGeminiArchive(year: number, months: string): Promise<any[]> {
  const prompt = `רשום אירועי שריפה, התלקחות או פיצוץ של סוללות ליתיום שקרו בישראל בחודשים ${months} ${year}.

כללים:
1. כלול רק: שריפה/פיצוץ/התלקחות של סוללת ליתיום יון
2. סוגי מכשירים: אופניים חשמליים, קורקינט חשמלי, רכב חשמלי, טלפון נייד, מחשב נייד, UPS/גיבוי, סוללת כוח, קלנועית, כלי עבודה, אחר
3. לא לכלול: תאונות דרכים רגילות, גניבות, חקיקה, כתבות כלליות
4. מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום
5. חומרה: קל, בינוני, חמור, קריטי
6. רק אירועים אמיתיים שדווחו בתקשורת!

החזר JSON array בלבד, בלי markdown, בלי backticks:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"חומרה","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"מקור","source_url":""}]

אם אין אירועים החזר [].`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
        }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

// ============================================
// Analyze articles with Gemini
// ============================================
async function analyzeArticles(articles: string[]): Promise<any[]> {
  if (articles.length === 0) return [];

  const prompt = `אתה מנתח כתבות חדשות על שריפות סוללות ליתיום בישראל.

כללים:
1. כלול רק: שריפה/פיצוץ/התלקחות של סוללת ליתיום
2. סוגי מכשירים: אופניים חשמליים, קורקינט חשמלי, רכב חשמלי, טלפון נייד, מחשב נייד, UPS/גיבוי, סוללת כוח, קלנועית, כלי עבודה, אחר
3. מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום
4. אם אותו אירוע מופיע בכמה כתבות — דווח פעם אחת

החזר JSON array בלבד:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"מקור","source_url":""}]

הכתבות:
${articles.join("\n\n")}

אם אין אירועים רלוונטיים החזר [].`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
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

// ============================================
// Duplicate check
// ============================================
async function checkDuplicate(inc: any): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/incidents?incident_date=eq.${inc.incident_date}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const existing = await res.json();
    if (Array.isArray(existing) && existing.length > 0) return true;

    // Fuzzy: ±3 days
    const date = new Date(inc.incident_date);
    const before = new Date(date); before.setDate(before.getDate() - 3);
    const after = new Date(date); after.setDate(after.getDate() + 3);
    const fuzzyUrl = `${SUPABASE_URL}/rest/v1/incidents?incident_date=gte.${before.toISOString().split("T")[0]}&incident_date=lte.${after.toISOString().split("T")[0]}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const fuzzyRes = await fetch(fuzzyUrl, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const fuzzyExisting = await fuzzyRes.json();
    return Array.isArray(fuzzyExisting) && fuzzyExisting.length > 0;
  } catch {
    return false;
  }
}

// ============================================
// Insert incidents to Supabase
// ============================================
async function insertIncidents(incidents: any[]): Promise<{ inserted: number; duplicates: number }> {
  let inserted = 0;
  let duplicates = 0;

  for (const inc of incidents) {
    if (!inc.incident_date || !inc.city || !inc.device_type) continue;

    const isDup = await checkDuplicate(inc);
    if (isDup) { duplicates++; continue; }

    const row = {
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
      data_source: "archive_scan_v3",
      gemini_confidence: 0.7,
      verified: false,
    };

    try {
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
    } catch {}
  }

  return { inserted, duplicates };
}

// ============================================
// MAIN
// ============================================
export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);

  // Parse params
  const yearParam = url.searchParams.get("year");
  const monthParam = url.searchParams.get("month");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let dateAfter: string;
  let dateBefore: string;
  let label: string;

  if (fromParam && toParam) {
    dateAfter = fromParam;
    dateBefore = toParam;
    label = `${fromParam} to ${toParam}`;
  } else {
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    if (monthParam) {
      const month = parseInt(monthParam);
      dateAfter = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      dateBefore = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
      label = `${year}-${String(month).padStart(2, "0")}`;
    } else {
      dateAfter = `${year}-01-01`;
      dateBefore = `${year}-12-31`;
      label = `${year}`;
    }
  }

  const sources = { google_news: 0, telegram: 0, gemini_knowledge: 0 };
  const allIncidents: any[] = [];

  try {
    // === SOURCE 1: Google News Archive ===
    const googleQueries = [
      "שריפה+סוללת+ליתיום",
      "התלקחות+אופניים+חשמליים",
      "פיצוץ+סוללה+קורקינט",
      "שריפה+רכב+חשמלי+סוללה",
      "סוללה+בוערת+דירה",
    ];

    const googleArticles: string[] = [];
    for (const q of googleQueries) {
      const articles = await searchGoogleNewsArchive(q, dateAfter, dateBefore);
      googleArticles.push(...articles);
      await new Promise(r => setTimeout(r, 300)); // Rate limit
    }

    // Dedup google articles
    const seenTitles = new Set<string>();
    const uniqueGoogle = googleArticles.filter(a => {
      const title = JSON.parse(a).title.substring(0, 50);
      if (seenTitles.has(title)) return false;
      seenTitles.add(title);
      return true;
    });

    sources.google_news = uniqueGoogle.length;

    if (uniqueGoogle.length > 0) {
      // Analyze in batches of 10
      for (let i = 0; i < uniqueGoogle.length; i += 10) {
        const batch = uniqueGoogle.slice(i, i + 10);
        const incidents = await analyzeArticles(batch);
        allIncidents.push(...incidents);
      }
    }

    // === SOURCE 2: Telegram Archive ===
    const telegramChannels = ["fireisrael777", "mdaisrael", "uh1221", "maborhz"];
    const telegramQueries = ["סוללה", "ליתיום", "אופניים חשמליים", "קורקינט", "התלקחות"];

    const telegramArticles: string[] = [];
    for (const channel of telegramChannels) {
      for (const q of telegramQueries) {
        const articles = await searchTelegramArchive(channel, q);
        telegramArticles.push(...articles);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Dedup telegram
    const seenTg = new Set<string>();
    const uniqueTelegram = telegramArticles.filter(a => {
      const title = JSON.parse(a).title.substring(0, 60);
      if (seenTg.has(title)) return false;
      seenTg.add(title);
      return true;
    });

    sources.telegram = uniqueTelegram.length;

    if (uniqueTelegram.length > 0) {
      for (let i = 0; i < uniqueTelegram.length; i += 10) {
        const batch = uniqueTelegram.slice(i, i + 10);
        const incidents = await analyzeArticles(batch);
        allIncidents.push(...incidents);
      }
    }

    // === SOURCE 3: Gemini Knowledge (fallback) ===
    const year = parseInt(dateAfter.split("-")[0]);
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

    if (monthParam) {
      const m = parseInt(monthParam);
      const geminiResults = await askGeminiArchive(year, monthNames[m - 1]);
      sources.gemini_knowledge = geminiResults.length;
      allIncidents.push(...geminiResults);
    } else {
      // Split to 2 halves to avoid Gemini output limits
      const h1 = await askGeminiArchive(year, "ינואר עד יוני");
      await new Promise(r => setTimeout(r, 500));
      const h2 = await askGeminiArchive(year, "יולי עד דצמבר");
      sources.gemini_knowledge = h1.length + h2.length;
      allIncidents.push(...h1, ...h2);
    }

    // === Dedup all incidents across sources ===
    const seen = new Set<string>();
    const uniqueIncidents = allIncidents.filter(inc => {
      const key = `${inc.incident_date}_${inc.city}_${inc.device_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // === Filter by date range ===
    const filtered = uniqueIncidents.filter(inc => {
      return inc.incident_date >= dateAfter && inc.incident_date <= dateBefore;
    });

    // === Insert to Supabase ===
    const { inserted, duplicates } = await insertIncidents(filtered);

    return Response.json({
      status: "ok",
      period: label,
      date_range: { from: dateAfter, to: dateBefore },
      sources,
      total_found: filtered.length,
      inserted,
      duplicates,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json({
      status: "error",
      message: e.message,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}
