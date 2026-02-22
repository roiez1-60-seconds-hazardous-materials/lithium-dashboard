// app/api/scan-archive/route.ts
// V7 — Gemini-only archive scanner
// One Gemini call per month = fast, accurate, knows Israeli incidents
// Usage:
//   /api/scan-archive?year=2024&month=6              → Gemini knowledge
//   /api/scan-archive?year=2024&month=6&mode=news    → Google News + Groq fallback
//   /api/scan-archive?telegram=uh1221&q=סוללה        → Telegram + Groq

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const TG_PROXY = process.env.TG_PROXY_URL || "";

const MONTH_NAMES = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

// ============================================
// Call Gemini
// ============================================
async function callGemini(prompt: string): Promise<string> {
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
  if (!res.ok) throw new Error(`gemini_${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ============================================
// Call Groq (fallback for Telegram/News)
// ============================================
async function callGroq(prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
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
// Process incidents array — dedup + insert
// ============================================
async function processIncidents(incidents: any[], source: string) {
  let inserted = 0, duplicates = 0;
  for (const inc of incidents) {
    if (!inc.incident_date || !inc.city || !inc.device_type) continue;
    if (await checkDuplicate(inc)) { duplicates++; continue; }
    if (await insertIncident(inc, source)) inserted++;
  }
  return { inserted, duplicates };
}

// ============================================
// Build the Gemini prompt for a month
// ============================================
function buildGeminiPrompt(monthName: string, year: number): string {
  return `אתה חוקר שריפות סוללות ליתיום בישראל. מומחה בנושא.

רשום את כל אירועי שריפה, התלקחות, פיצוץ, דליקה, עשן או בריחה תרמית של סוללות ליתיום שקרו בישראל בחודש ${monthName} ${year}.

סוגי אירועים לכלול:
- אופניים חשמליים (שריפה/התלקחות/פיצוץ בזמן טעינה, נסיעה, חנייה)
- קורקינט חשמלי (שריפה/התלקחות/פיצוץ)
- רכב חשמלי (שריפה/התלקחות, כולל טסלה, BYD, וכל יצרן)
- רכב היברידי / פלאג-אין (שריפה/התלקחות של הסוללה)
- קלנועית חשמלית (שריפה/התלקחות)
- אופנוע חשמלי (שריפה/התלקחות)
- מתקן אגירת אנרגיה / חוות סוללות (שריפה/התלקחות/פיצוץ)
- פאוורבנק (שריפה/פיצוץ/התלקחות)
- טלפון נייד / סמארטפון (סוללה התפוצצה/נדלקה)
- מחשב נייד / טאבלט (סוללה נדלקה)
- סיגריה אלקטרונית / ויפ (סוללה התפוצצה)
- UPS / מערכת גיבוי (סוללת ליתיום נדלקה)
- מטען סוללה (שריפה בזמן טעינה)
- כלי עבודה חשמליים (סוללת ליתיום נדלקה)
- רחפן (סוללה נדלקה)
- כל מכשיר אחר עם סוללת ליתיום

לא לכלול:
- תאונות דרכים רגילות (בלי שריפה מהסוללה)
- גניבות
- חקיקה, רגולציה, מאמרי דעה
- כתבות כלליות על סכנות ליתיום
- אירועים מחוץ לישראל

מחוזות: צפון, חוף, דן, מרכז, ירושלים, יהודה ושומרון, דרום

חשוב מאוד: רק אירועים אמיתיים וספציפיים שדווחו בתקשורת הישראלית!
אם אתה לא בטוח לגבי תאריך מדויק, תן את התאריך המשוער.

החזר JSON array בלבד. בלי markdown, בלי backticks, בלי הסברים לפני או אחרי:
[{"incident_date":"YYYY-MM-DD","city":"שם העיר","district":"מחוז","device_type":"סוג המכשיר","severity":"קל/בינוני/חמור/קריטי","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור קצר של האירוע","source_name":"שם המקור","source_url":""}]

אם אין אירועים בחודש זה — החזר []`;
}

// ============================================
// MODE: Telegram Archive
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

  const msgText = messages.map((m, i) => `[${i+1}] (${m.date}) ${m.text}`).join("\n");
  const prompt = `הודעות מטלגרם ערוץ ${channel}, חיפוש "${query}".
זהה רק הודעות על שריפה/פיצוץ/התלקחות של סוללות ליתיום (אופניים חשמליים, קורקינט, רכב חשמלי/היברידי, קלנועית, מתקן אגירה, פאוורבנק, טלפון, וכו).
לא לכלול: תאונות רגילות, פציעות ללא שריפת סוללה, כתבות כלליות.
החזר JSON array בלבד:
[{"incident_date":"YYYY-MM-DD","city":"עיר","district":"מחוז","device_type":"סוג","severity":"חומרה","injuries":0,"fatalities":0,"property_damage":true,"description":"תיאור","source_name":"טלגרם ${channel}","source_url":""}]
אם אין — []

ההודעות:
${msgText}`;

  const llmText = GROQ_KEY ? await callGroq(prompt) : await callGemini(prompt);
  const incidents = parseLlmJson(llmText);
  const { inserted, duplicates } = await processIncidents(incidents, `telegram_${channel}`);
  return { channel, query, messages_found: messages.length, found: incidents.length, inserted, duplicates };
}

// ============================================
// MAIN HANDLER
// ============================================
export async function GET(request: Request) {
  const startTime = Date.now();
  const url = new URL(request.url);

  try {
    // MODE: Telegram
    const telegramParam = url.searchParams.get("telegram");
    if (telegramParam) {
      const query = url.searchParams.get("q") || "סוללה";
      const result = await scanTelegram(telegramParam, query);
      return Response.json({ status: "ok", mode: "telegram", ...result, duration_ms: Date.now() - startTime });
    }

    // Parse year/month
    const year = parseInt(url.searchParams.get("year") || "2024");
    const month = parseInt(url.searchParams.get("month") || "0");

    if (!month || month < 1 || month > 12) {
      return Response.json({
        error: "specify month",
        usage: "/api/scan-archive?year=2024&month=6",
      }, { status: 400 });
    }

    const monthName = MONTH_NAMES[month - 1];

    // DEFAULT MODE: Gemini knowledge (the main mode!)
    if (!GEMINI_KEY) {
      return Response.json({ error: "missing GEMINI_API_KEY", status: "error" }, { status: 500 });
    }

    const prompt = buildGeminiPrompt(monthName, year);
    const geminiText = await callGemini(prompt);
    const incidents = parseLlmJson(geminiText);
    const { inserted, duplicates } = await processIncidents(incidents, "archive_gemini");

    return Response.json({
      status: "ok",
      mode: "gemini",
      period: `${monthName} ${year}`,
      found: incidents.length,
      inserted,
      duplicates,
      duration_ms: Date.now() - startTime,
    });

  } catch (e: any) {
    return Response.json({ status: "error", message: e.message, duration_ms: Date.now() - startTime }, { status: 500 });
  }
}
