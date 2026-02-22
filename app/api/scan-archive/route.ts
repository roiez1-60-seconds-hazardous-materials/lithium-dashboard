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
  const tgUrl = `https://t.me/s/${channel}?q=${encodeURIComponent(query)}`;
  const tgRes = await fetch(tgUrl, {
    signal: AbortSignal.timeout(10000),
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
          telegram_examples: [
            "/api/scan-archive?telegram=fireisrael777&q=סוללה",
            "/api/scan-archive?telegram=fireisrael777&q=קורקינט",
            "/api/scan-archive?telegram=mdaisrael&q=אופניים",
            "/api/scan-archive?telegram=mdaisrael&q=התלקחות",
            "/api/scan-archive?telegram=uh1221&q=סוללה",
            "/api/scan-archive?telegram=uh1221&q=שריפה",
          ],
        },
      }, { status: 400 });
    }

    const result = await scanKnowledge(year, month);
    return Response.json({ status: "ok", mode: "knowledge", ...result, duration_ms: Date.now() - startTime });

  } catch (e: any) {
    return Response.json({ status: "error", message: e.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
