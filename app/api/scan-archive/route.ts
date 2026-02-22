// app/api/scan-archive/route.ts
// V6 — Uses Groq (Llama) for archive scanning — 14,400 free requests/day
// Gemini stays for the daily scanner, Groq handles archive bulk work
// Usage:
//   /api/scan-archive?year=2024&month=6          → Groq knowledge
//   /api/scan-archive?telegram=fireisrael777&q=סוללה  → Telegram + Groq analysis

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GROQ_KEY = process.env.GROQ_API_KEY!;
const TG_PROXY = process.env.TG_PROXY_URL || "";

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ============================================
// Call Groq (Llama) — OpenAI-compatible API
// ============================================
async function callGroq(prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "אתה מנתח נתוני שריפות סוללות ליתיום בישראל. תמיד החזר JSON array בלבד, בלי markdown, בלי הסברים." },
        { role: "user", content: prompt },
      ],
      temperature: 0.15,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`groq_${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ============================================
// Parse JSON from LLM response
// ============================================
function parseLlmJson(text: string): any[] {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
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

    const date = new Date(inc.incident_date);
    const before = new Date(date); before.setDate(before.getDate() - 3);
    const after = new Date(date); after.setDate(after.getDate() + 3);
    const fuzzyUrl = `${SUPABASE_URL}/rest/v1/incidents?incident_date=gte.${before.toISOString().split("T")[0]}&incident_date=lte.${after.toISOString().split("T")[0]}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const fuzzyRes = await fetch(fuzzyUrl, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const fuzzyExisting = await fuzzyRes.json();
    return Array.isArray(fuzzyExisting) && fuzzyExisting.length > 0;
  } catch { return false; }
}

// ============================================
// Insert one incident
// ============================================
async function insertIncident(inc: any, dataSource: string): Promise<boolean> {
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
    data_source: dataSource,
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
    return res.ok;
  } catch { return false; }
}

// ============================================
// Process incidents — dedup & insert
// ============================================
async function processIncidents(incidents: any[], dataSource: string) {
  let inserted = 0, duplicates = 0;
  for (const inc of incidents) {
    if (!inc.incident_date || !inc.city || !inc.device_type) continue;
    if (await checkDuplicate(inc)) { duplicates++; continue; }
    if (await insertIncident(inc, dataSource)) inserted++;
  }
  return { inserted, duplicates };
}

// ============================================
// MODE 1: LLM Knowledge — one month
// ============================================
async function scanKnowledge(year: number, month: number) {
  const monthName = MONTH_NAMES[month - 1];

  const prompt = `רשום כל אירועי שריפה, התלקחות או פיצוץ של סוללות ליתיום יון שקרו בישראל בחודש ${monthName} ${year}.

כלול: אופניים חשמליים, קורקינטים, רכבים חשמליים, קלנועיות, טלפונים, פאוורבנקים, UPS, מחשבים ניידים.
לא לכלול: תאונות דרכים רגילות, גניבות, חקיקה, מאמרי דעה.
רק אירועים אמיתיים שדווחו בתקשורת הישראלית!
מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום

החזר JSON array בלבד:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"מקור","source_url":""}]
אם אין — החזר []`;

  const text = await callGroq(prompt);
  const incidents = parseLlmJson(text);
  const { inserted, duplicates } = await processIncidents(incidents, "archive_groq");

  return { period: `${monthName} ${year}`, found: incidents.length, inserted, duplicates };
}

// ============================================
// MODE 2: Telegram Archive — one channel + query
// ============================================
async function scanTelegram(channel: string, query: string) {
  const tgUrl = TG_PROXY
    ? `${TG_PROXY}?channel=${channel}&q=${encodeURIComponent(query)}`
    : `https://t.me/s/${channel}?q=${encodeURIComponent(query)}`;
  const tgRes = await fetch(tgUrl, {
    signal: AbortSignal.timeout(15000),
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!tgRes.ok) throw new Error(`telegram_${tgRes.status}`);
  const html = await tgRes.text();

  // Extract messages with dates
  const messages: { text: string; date: string }[] = [];
  const msgRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const dateRegex = /<time[^>]*datetime="([^"]*)"[^>]*>/gi;

  const dates: string[] = [];
  let dm;
  while ((dm = dateRegex.exec(html)) !== null) dates.push(dm[1]);

  let mm;
  let idx = 0;
  while ((mm = msgRegex.exec(html)) !== null) {
    const text = mm[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
    if (text.length > 20) {
      messages.push({ text: text.substring(0, 400), date: dates[idx] || "" });
    }
    idx++;
  }

  if (messages.length === 0) {
    return { channel, query, messages_found: 0, found: 0, inserted: 0, duplicates: 0 };
  }

  // Analyze with Groq
  const msgText = messages.slice(0, 30).map((m, i) => `[${i + 1}] (${m.date}) ${m.text}`).join("\n\n");

  const prompt = `נתח את ההודעות הבאות מערוץ טלגרם @${channel}.
מצא רק אירועי שריפה/התלקחות/פיצוץ של סוללות ליתיום.
לא לכלול: תאונות דרכים רגילות, פינוי רגיל, כתבות כלליות.
מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום

החזר JSON array בלבד:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"telegram @${channel}","source_url":""}]
אם אין — החזר []

ההודעות:
${msgText}`;

  const text = await callGroq(prompt);
  const incidents = parseLlmJson(text);
  const { inserted, duplicates } = await processIncidents(incidents, `archive_tg_${channel}`);

  return { channel, query, messages_found: messages.length, found: incidents.length, inserted, duplicates };
}

// ============================================
// MAIN
// ============================================
export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    // Check if Groq key exists
    if (!GROQ_KEY) {
      return Response.json({
        error: "חסר GROQ_API_KEY. הוסף בהגדרות Vercel → Environment Variables.",
        signup: "https://console.groq.com",
      }, { status: 500 });
    }

    // MODE 2: Telegram
    const telegramParam = url.searchParams.get("telegram");
    if (telegramParam) {
      const query = url.searchParams.get("q") || "סוללה";
      const result = await scanTelegram(telegramParam, query);
      return Response.json({ status: "ok", mode: "telegram", ...result, duration_ms: Date.now() - startTime });
    }

    // MODE 1: Knowledge
    const year = parseInt(url.searchParams.get("year") || "2024");
    const month = parseInt(url.searchParams.get("month") || "0");

    if (!month || month < 1 || month > 12) {
      return Response.json({
        error: "צריך לציין חודש",
        usage: {
          knowledge: "/api/scan-archive?year=2024&month=6",
          news: "/api/scan-archive?year=2024&month=6&mode=news",
          telegram_examples: [
            "/api/scan-archive?telegram=fireisrael777&q=סוללה",
          ],
        },
      }, { status: 400 });
    }

    const mode = url.searchParams.get("mode");

    // MODE 3: Google News archive + Groq analysis
    if (mode === "news") {
      const monthStr = String(month).padStart(2, "0");
      const dateAfter = `${year}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const dateBefore = `${year}-${monthStr}-${lastDay}`;

      const queries = [
        // סוללות ליתיום כללי
        "שריפה+סוללת+ליתיום",
        "התלקחות+סוללת+ליתיום",
        "פיצוץ+סוללת+ליתיום",
        "דליקה+סוללת+ליתיום",
        "סוללות+ליתיום+שריפה",
        "סוללות+ליתיום+התלקחות",
        "סוללות+ליתיום+פיצוץ",
        "סוללות+ליתיום+דליקה",
        "סוללה+ליתיום+התפוצצה",
        "סוללה+ליתיום+נדלקה",
        "סוללה+ליתיום+עשן",
        "סוללה+ליתיום+חממה",
        "סוללה+ליתיום+בוערת",
        "בריחה+תרמית+סוללה",
        "בריחה+תרמית+ליתיום",
        // אופניים חשמליים
        "שריפה+אופניים+חשמליים",
        "שריפת+אופניים+חשמליים",
        "התלקחות+אופניים+חשמליים",
        "פיצוץ+אופניים+חשמליים",
        "דליקה+אופניים+חשמליים",
        "אופניים+חשמליים+נדלקו",
        "אופניים+חשמליים+עלו+באש",
        "אופניים+חשמליים+עשן",
        "טעינת+אופניים+חשמליים+שריפה",
        "טעינת+אופניים+חשמליים+דליקה",
        "סוללת+אופניים+חשמליים+שריפה",
        "סוללת+אופניים+חשמליים+התלקחות",
        // אופנוע חשמלי
        "שריפה+אופנוע+חשמלי",
        "התלקחות+אופנוע+חשמלי",
        "סוללת+אופנוע+חשמלי+שריפה",
        // קורקינט חשמלי
        "שריפה+קורקינט+חשמלי",
        "שריפת+קורקינט+חשמלי",
        "התלקחות+קורקינט+חשמלי",
        "פיצוץ+קורקינט+חשמלי",
        "דליקה+קורקינט+חשמלי",
        "קורקינט+חשמלי+נדלק",
        "קורקינט+חשמלי+עלה+באש",
        "קורקינט+חשמלי+עשן",
        "טעינת+קורקינט+חשמלי+שריפה",
        "סוללת+קורקינט+שריפה",
        "סוללת+קורקינט+התלקחות",
        // רכב חשמלי
        "שריפה+רכב+חשמלי",
        "שריפת+רכב+חשמלי",
        "התלקחות+רכב+חשמלי",
        "דליקה+רכב+חשמלי",
        "רכב+חשמלי+נדלק",
        "רכב+חשמלי+עלה+באש",
        "רכב+חשמלי+בוער",
        "סוללת+רכב+חשמלי+שריפה",
        "טעינת+רכב+חשמלי+שריפה",
        "רכב+חשמלי+חניון+שריפה",
        "טסלה+שריפה+סוללה",
        "BYD+שריפה+סוללה",
        // רכב היברידי
        "שריפה+רכב+היברידי+סוללה",
        "שריפת+רכב+היברידי",
        "התלקחות+רכב+היברידי+סוללה",
        "רכב+היברידי+סוללה+נדלק",
        "פלאג+אין+שריפה+סוללה",
        // קלנועית
        "שריפה+קלנועית+חשמלית",
        "שריפת+קלנועית+סוללה",
        "התלקחות+קלנועית+חשמלית",
        "קלנועית+חשמלית+נדלקה",
        "סוללת+קלנועית+שריפה",
        // מתקן אגירת אנרגיה
        "שריפה+מתקן+אגירת+אנרגיה",
        "שריפת+מתקן+אגירה+סוללות",
        "התלקחות+מתקן+אגירה+סוללות",
        "פיצוץ+מתקן+אגירה+סוללות",
        "אגירת+אנרגיה+סוללות+שריפה",
        "חוות+סוללות+שריפה",
        "חוות+סוללות+התלקחות",
        "מאגר+סוללות+שריפה",
        "מערכת+אגירה+סוללות+שריפה",
        "אגירה+סולארית+סוללות+שריפה",
        "מתקן+סולארי+סוללות+שריפה",
        // פאוורבנק ומטענים
        "שריפה+פאוורבנק+ליתיום",
        "פיצוץ+פאוורבנק",
        "פאוורבנק+נדלק",
        "פאוורבנק+התלקח",
        "מטען+סוללה+שריפה",
        "מטען+ליתיום+נדלק",
        // טלפונים וטאבלטים
        "טלפון+סוללה+התפוצץ",
        "טלפון+סוללה+נדלק",
        "סמארטפון+סוללה+שריפה",
        "סוללת+טלפון+התלקחה",
        "טאבלט+סוללה+שריפה",
        // מחשבים
        "מחשב+נייד+סוללה+נדלק",
        "מחשב+נייד+סוללה+שריפה",
        "לפטופ+סוללת+ליתיום+שריפה",
        // UPS ואלקטרוניקה
        "UPS+סוללה+שריפה",
        "UPS+ליתיום+התלקח",
        "סיגריה+אלקטרונית+סוללה+התפוצצה",
        "ויפ+סוללה+התפוצץ",
        // כלים וציוד
        "כלי+עבודה+סוללת+ליתיום+שריפה",
        "רחפן+סוללה+שריפה",
        "שואב+רובוטי+סוללה+שריפה",
        // מיקומים + סוללה
        "סוללה+שריפה+דירה",
        "סוללה+שריפה+בניין",
        "סוללה+שריפה+חניון",
        "סוללה+שריפה+מוסך",
        "סוללה+שריפה+חנות",
        "סוללה+שריפה+מחסן",
        // פציעות + סוללה
        "כוויות+סוללת+ליתיום",
        "כוויות+אופניים+חשמליים+סוללה",
        "נהרג+שריפה+סוללת+ליתיום",
        "נספה+שריפה+סוללה",
        "נפגע+סוללה+התפוצצה",
      ];

      const allArticles: string[] = [];
      for (const q of queries) {
        try {
          const fullQuery = `${q}+after:${dateAfter}+before:${dateBefore}`;
          const gUrl = `https://news.google.com/rss/search?q=${fullQuery}&hl=he&gl=IL&ceid=IL:he`;
          const res = await fetch(gUrl, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;
          const text = await res.text();

          const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
          let m;
          while ((m = itemRegex.exec(text)) !== null) {
            const title = m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || "";
            const pubDate = m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
            if (title.length > 10) allArticles.push(`(${pubDate}) ${title}`);
          }
        } catch {}
      }

      // Dedup
      const seen = new Set<string>();
      const unique = allArticles.filter(a => {
        const key = a.substring(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unique.length === 0) {
        return Response.json({
          status: "ok", mode: "news", period: `${MONTH_NAMES[month-1]} ${year}`,
          articles_found: 0, found: 0, inserted: 0, duplicates: 0,
          duration_ms: Date.now() - startTime,
        });
      }

      // Analyze with Groq (max 20 articles)
      const articleText = unique.slice(0, 20).join("\n");
      const prompt = `נתח את הכותרות הבאות מחדשות ישראל ומצא אירועי שריפה/התלקחות/פיצוץ של סוללות ליתיום בלבד.
לא לכלול: תאונות דרכים, כתבות כלליות על בטיחות, חקיקה.
מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום

החזר JSON array בלבד:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"מקור","source_url":""}]
אם אין — החזר []

הכותרות:
${articleText}`;

      const groqText = await callGroq(prompt);
      const incidents = parseLlmJson(groqText);
      const { inserted, duplicates } = await processIncidents(incidents, "archive_news_groq");

      return Response.json({
        status: "ok", mode: "news", period: `${MONTH_NAMES[month-1]} ${year}`,
        articles_found: unique.length, found: incidents.length, inserted, duplicates,
        sample_articles: unique.slice(0, 5),
        duration_ms: Date.now() - startTime,
      });
    }

    // MODE 4: Gemini knowledge (when quota available)
    if (mode === "gemini") {
      const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
      if (!GEMINI_KEY) {
        return Response.json({ error: "missing GEMINI_API_KEY" }, { status: 500 });
      }
      const monthName = MONTH_NAMES[month - 1];
      const prompt = `אתה חוקר שריפות סוללות ליתיום בישראל. רשום את כל אירועי שריפה, התלקחות או פיצוץ של סוללות ליתיום שקרו בישראל בחודש ${monthName} ${year}.

כלול: אופניים חשמליים, קורקינטים חשמליים, רכבים חשמליים, קלנועיות, טלפונים, פאוורבנקים, UPS, מחשבים ניידים, כל מכשיר עם סוללת ליתיום.
לא לכלול: תאונות דרכים רגילות ללא שריפה, גניבות, חקיקה, מאמרי דעה, כתבות כלליות.
רק אירועים אמיתיים וספציפיים שדווחו בתקשורת הישראלית!
מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום

החזר JSON array בלבד. בלי markdown בלי backticks:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר","source_name":"מקור","source_url":""}]
אם אין — החזר []`;

      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15, maxOutputTokens: 8192 },
          }),
        }
      );
      if (!gRes.ok) throw new Error(`gemini_${gRes.status}`);
      const gData = await gRes.json();
      const gText = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const incidents = parseLlmJson(gText);
      const { inserted, duplicates } = await processIncidents(incidents, "archive_gemini");

      return Response.json({
        status: "ok", mode: "gemini", period: `${monthName} ${year}`,
        found: incidents.length, inserted, duplicates,
        duration_ms: Date.now() - startTime,
      });
    }

    const result = await scanKnowledge(year, month);
    return Response.json({ status: "ok", mode: "knowledge", ...result, duration_ms: Date.now() - startTime });

  } catch (e: any) {
    return Response.json({ status: "error", message: e.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
