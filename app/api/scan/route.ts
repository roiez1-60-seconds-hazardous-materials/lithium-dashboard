// app/api/scan/route.ts
// V2 — Enhanced scanner for lithium battery fire incidents in Israel
// Sources: RSS feeds (expanded), Google News, Telegram channels
// Push notifications via Supabase + web push
// Triggered by Vercel Cron every 6 hours

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const GEMINI_KEY = process.env.GEMINI_API_KEY!;

// ============================================
// SOURCE 1: RSS Feeds (expanded)
// ============================================
const RSS_FEEDS = [
  // — Major national news —
  "https://www.ynet.co.il/Integration/StoryRss2.xml",
  "https://www.ynet.co.il/Integration/StoryRss1854.xml",        // ynet local news
  "https://rss.walla.co.il/feed/1",                             // walla main
  "https://rss.walla.co.il/feed/22",                            // walla local/cities
  "https://www.maariv.co.il/Rss/RssFeedsMivzakChadashot",       // maariv breaking
  "https://www.maariv.co.il/Rss/RssFeedsBreaking",              // maariv flash
  "https://www.israelhayom.co.il/rss",                          // israel hayom
  "https://www.calcalist.co.il/GeneralRss/0,16335,L-8,00.xml",  // calcalist
  "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", // globes
  // — Local / Community news —
  "https://www.bhol.co.il/rss/1.xml",                           // behadrey haredim
  "https://www.kikar.co.il/rss",                                // kikar hashabbat
  "https://www.ice.co.il/rss/main.xml",                         // ice
  "https://www.jdn.co.il/rss",                                  // JDN
  "https://www.news1.co.il/Rss/RssFeedsMivzakChadashot.xml",    // news1
  // — Emergency / Rescue oriented —
  "https://www.mako.co.il/AjaxPage?jspName=rssFeed.jsp",        // mako/N12
  "https://13news.co.il/feed/",                                 // channel 13
];

// ============================================
// SOURCE 2: Google News search
// ============================================
const GOOGLE_NEWS_QUERIES = [
  "שריפה+סוללת+ליתיום+ישראל",
  "התלקחות+סוללת+ליתיום",
  "פיצוץ+סוללת+ליתיום",
  "סוללות+ליתיום+שריפה+ישראל",
  "סוללות+ליתיום+התלקחות",
  "שריפה+אופניים+חשמליים",
  "שריפת+אופניים+חשמליים",
  "התלקחות+אופניים+חשמליים",
  "סוללת+אופניים+חשמליים+שריפה",
  "טעינת+אופניים+חשמליים+שריפה",
  "שריפה+קורקינט+חשמלי",
  "שריפת+קורקינט+חשמלי",
  "התלקחות+קורקינט+חשמלי",
  "סוללת+קורקינט+שריפה",
  "שריפה+רכב+חשמלי+ישראל",
  "שריפת+רכב+חשמלי",
  "התלקחות+רכב+חשמלי",
  "סוללת+רכב+חשמלי+שריפה",
  "שריפה+רכב+היברידי+סוללה",
  "שריפת+רכב+היברידי",
  "שריפה+קלנועית+חשמלית",
  "סוללת+קלנועית+שריפה",
  "שריפה+מתקן+אגירת+אנרגיה",
  "חוות+סוללות+שריפה",
  "מאגר+סוללות+שריפה",
  "אגירת+אנרגיה+סוללות+שריפה",
  "שריפה+פאוורבנק+ליתיום",
  "שריפה+אופנוע+חשמלי",
  "סוללה+ליתיום+התפוצצה",
  "סוללה+ליתיום+נדלקה",
  "כוויות+סוללת+ליתיום",
  "נהרג+שריפה+סוללת+ליתיום",
  "בריחה+תרמית+סוללה",
  "סוללה+שריפה+דירה",
  "סוללה+שריפה+חניון",
  "רכב+חשמלי+חניון+שריפה",
  "סיגריה+אלקטרונית+סוללה+התפוצצה",
];

// ============================================
// SOURCE 3: Telegram public channels
// ============================================
const TELEGRAM_CHANNELS = [
  "fireisrael777",    // כבאות והצלה ארצי (לא רשמי, מבצעי)
  "mdaisrael",        // מגן דוד אדום (רשמי)
  "uh1221",           // איחוד הצלה (רשמי)
  "maborhz",          // מבזקי חדשות
  "newslocker",        // נעילת חדשות
  "kann11news",        // כאן 11
  "redalertisrael",    // צבע אדום / חירום
];

// ============================================
// SOURCE 4: Twitter/X accounts (via Nitter)
// ============================================
const TWITTER_ACCOUNTS = [
  "102_IL",            // כבאות והצלה לישראל (רשמי)
  "MikiHaimovich",     // מיקי חיימוביץ - תחקירי בטיחות
];

// Nitter instances (fallback chain — these go up and down)
const NITTER_INSTANCES = [
  "nitter.privacydev.net",
  "nitter.poast.org",
  "nitter.net",
];

// ============================================
// SOURCE 5: Facebook public pages
// ============================================
const FACEBOOK_PAGES = [
  "102israel",          // כבאות והצלה לישראל (רשמי)
  "MDAisrael",          // מגן דוד אדום
];

// ============================================
// Keywords for pre-filtering
// ============================================
const KEYWORDS = [
  "סוללת ליתיום", "ליתיום", "אופניים חשמליים", "אופניים חשמלי",
  "קורקינט חשמלי", "קורקינט", "רכב חשמלי", "קלנועית",
  "סוללה התלקחה", "סוללה התפוצצה", "התלקחות סוללה", "פיצוץ סוללה",
  "טעינת סוללה", "בריחה תרמית", "thermal runaway",
  "פאוורבנק", "power bank", "UPS", "מתקן אגירה",
  "סוללה נדלקה", "סוללה עלתה באש", "סוללה בוערת",
  "אופניים נדלקו", "קורקינט נדלק", "רכב חשמלי נשרף",
  "מטען התלקח", "מטען התפוצץ",
];

const FIRE_WORDS = [
  "שריפ", "התלקח", "התפוצצ", "בוער", "בער", "נדלק", "עלה באש",
  "אש ", "להבות", "פיצוץ", "עשן", "פונו", "חילוץ", "כיבוי",
  "כבאי", "כבאות", "לוכד", "נשרף",
];

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  const hasKeyword = KEYWORDS.some(kw => lower.includes(kw));
  const hasFire = FIRE_WORDS.some(fw => lower.includes(fw));
  return hasKeyword && hasFire;
}

// ============================================
// RSS Feed fetcher
// ============================================
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

      const combined = `${title} ${desc}`;
      if (matchesKeywords(combined)) {
        items.push(JSON.stringify({ title, desc: desc.substring(0, 500), link, pubDate, source: "rss" }));
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ============================================
// Google News fetcher (RSS format)
// ============================================
async function fetchGoogleNews(): Promise<string[]> {
  const items: string[] = [];
  for (const query of GOOGLE_NEWS_QUERIES) {
    try {
      const url = `https://news.google.com/rss/search?q=${query}&hl=he&gl=IL&ceid=IL:he`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(text)) !== null) {
        const item = match[1];
        const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || "";
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
        const sourceName = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || "Google News";

        // Google News results are already filtered by query, but double-check
        if (title.length > 10) {
          items.push(JSON.stringify({
            title,
            desc: title, // Google News RSS doesn't always have description
            link,
            pubDate,
            source: `google_news (${sourceName})`,
          }));
        }
      }
    } catch {
      continue;
    }
  }
  // Deduplicate by title similarity
  const seen = new Set<string>();
  return items.filter(item => {
    const parsed = JSON.parse(item);
    const key = parsed.title.substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================
// Telegram public channel fetcher
// ============================================
async function fetchTelegram(): Promise<string[]> {
  const items: string[] = [];
  for (const channel of TELEGRAM_CHANNELS) {
    try {
      const url = `https://t.me/s/${channel}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) continue;
      const html = await res.text();

      const msgRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let match;
      while ((match = msgRegex.exec(html)) !== null) {
        const text = match[1]
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .trim();

        if (text.length > 20 && matchesKeywords(text)) {
          items.push(JSON.stringify({
            title: text.substring(0, 200),
            desc: text.substring(0, 500),
            link: `https://t.me/s/${channel}`,
            pubDate: new Date().toISOString(),
            source: `telegram (@${channel})`,
          }));
        }
      }
    } catch {
      continue;
    }
  }
  return items;
}

// ============================================
// Twitter/X fetcher (via Nitter instances)
// ============================================
async function fetchTwitter(): Promise<string[]> {
  const items: string[] = [];

  for (const account of TWITTER_ACCOUNTS) {
    let fetched = false;

    // Try Nitter RSS first (most reliable)
    for (const instance of NITTER_INSTANCES) {
      if (fetched) break;
      try {
        const rssUrl = `https://${instance}/${account}/rss`;
        const res = await fetch(rssUrl, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) continue;
        const text = await res.text();

        const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = itemRegex.exec(text)) !== null) {
          const item = match[1];
          const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || "";
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
          const desc = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1] || "";

          const cleanText = `${title} ${desc}`.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

          if (cleanText.length > 20 && matchesKeywords(cleanText)) {
            items.push(JSON.stringify({
              title: cleanText.substring(0, 200),
              desc: cleanText.substring(0, 500),
              link: link.replace(instance, "x.com"),
              pubDate,
              source: `twitter (@${account})`,
            }));
          }
        }
        fetched = true;
      } catch {
        continue;
      }
    }

    // Fallback: scrape Nitter HTML if RSS failed
    if (!fetched) {
      for (const instance of NITTER_INSTANCES) {
        try {
          const htmlUrl = `https://${instance}/${account}`;
          const res = await fetch(htmlUrl, {
            signal: AbortSignal.timeout(8000),
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          if (!res.ok) continue;
          const html = await res.text();

          // Nitter tweet content is in .tweet-content class
          const tweetRegex = /<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
          let match;
          while ((match = tweetRegex.exec(html)) !== null) {
            const text = match[1]
              .replace(/<br\s*\/?>/gi, " ")
              .replace(/<[^>]+>/g, "")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim();

            if (text.length > 20 && matchesKeywords(text)) {
              items.push(JSON.stringify({
                title: text.substring(0, 200),
                desc: text.substring(0, 500),
                link: `https://x.com/${account}`,
                pubDate: new Date().toISOString(),
                source: `twitter (@${account})`,
              }));
            }
          }
          break; // Got HTML from this instance
        } catch {
          continue;
        }
      }
    }
  }
  return items;
}

// ============================================
// Facebook public page fetcher (mbasic version)
// ============================================
async function fetchFacebook(): Promise<string[]> {
  const items: string[] = [];

  for (const page of FACEBOOK_PAGES) {
    try {
      // mbasic.facebook.com serves lightweight HTML without JS requirement
      const url = `https://mbasic.facebook.com/${page}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
          "Accept-Language": "he-IL,he;q=0.9",
        },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // mbasic FB posts are in <div> with specific story patterns
      // Look for post text content — multiple possible selectors
      const postPatterns = [
        /<div[^>]*class="[^"]*(?:story_body_container|_5rgt)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
        /<div[^>]*data-ft[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
      ];

      for (const pattern of postPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const text = match[1]
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/\s+/g, " ")
            .trim();

          if (text.length > 30 && matchesKeywords(text)) {
            items.push(JSON.stringify({
              title: text.substring(0, 200),
              desc: text.substring(0, 500),
              link: `https://facebook.com/${page}`,
              pubDate: new Date().toISOString(),
              source: `facebook (${page})`,
            }));
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Deduplicate by content
  const seen = new Set<string>();
  return items.filter(item => {
    const parsed = JSON.parse(item);
    const key = parsed.title.substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================
// Gemini AI analyzer
// ============================================
async function analyzeWithGemini(articles: string[]): Promise<any[]> {
  const prompt = `אתה מנתח חדשות שריפות סוללות ליתיום בישראל עבור מסד נתונים של כבאות והצלה.

כללים:
1. כלול רק: שריפה/פיצוץ/התלקחות של סוללת ליתיום יון
2. סוגי מכשירים: אופניים חשמליים, קורקינט חשמלי, רכב חשמלי, טלפון נייד, מחשב נייד, UPS/גיבוי, סוללת כוח, כלי עבודה, אחר
3. לא לכלול: תאונת דרכים רגילה (אלא אם הסוללה עצמה נדלקה), גניבה, מכירות, חקיקה, כתבות כלליות על ליתיום, מאמרי דעה
4. מחוזות: צפון, חוף, דן, מרכז, ירושלים, יו"ש, דרום
5. חומרה: קל (נזק מינורי), בינוני (נזק רכוש), חמור (פצועים/נזק גדול), קריטי (הרוגים/נזק חמור)
6. אם אותו אירוע מופיע בכמה כתבות — דווח אותו פעם אחת בלבד

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

// ============================================
// Supabase: duplicate check
// ============================================
async function checkDuplicate(inc: any): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/incidents?incident_date=eq.${inc.incident_date}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}&select=id`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    const existing = await res.json();
    if (Array.isArray(existing) && existing.length > 0) return true;

    // Fuzzy dedup: ±3 days, same city, same device
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

// ============================================
// Supabase: insert incidents
// ============================================
async function insertToSupabase(incidents: any[]): Promise<{ inserted: number; newIncidents: any[] }> {
  if (!incidents.length) return { inserted: 0, newIncidents: [] };

  let inserted = 0;
  const newIncidents: any[] = [];

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
        data_source: "gemini_scan_v2",
        gemini_confidence: 0.8,
        verified: false,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/incidents`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
      });

      if (res.ok) {
        inserted++;
        const data = await res.json();
        newIncidents.push(data[0] || row);
      }
    } catch {
      continue;
    }
  }
  return { inserted, newIncidents };
}

// ============================================
// Push notification: store for subscribers
// ============================================
async function sendPushNotifications(newIncidents: any[]) {
  if (newIncidents.length === 0) return;

  // Get all push subscribers from Supabase
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/push_subscribers?select=*`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    if (!res.ok) return;
    const subscribers = await res.json();
    if (!Array.isArray(subscribers) || subscribers.length === 0) return;

    // Build notification for each new incident
    for (const inc of newIncidents) {
      const title = `🔥 שריפת ליתיום — ${inc.city}`;
      const body = `${inc.device_type} | ${inc.severity} | ${inc.description?.substring(0, 100) || ""}`;

      // Store notification in notifications table (for in-app display + push)
      await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          title,
          body,
          incident_id: inc.id || null,
          severity: inc.severity,
          sent_at: new Date().toISOString(),
        }),
      });

      // Send Web Push to each subscriber
      for (const sub of subscribers) {
        try {
          if (!sub.endpoint) continue;
          // Web Push via Supabase Edge Function or direct
          // Note: for full Web Push you need VAPID keys + web-push library
          // This stores the notification; the client polls or uses Supabase Realtime
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Push is best-effort, don't fail the scan
  }
}

// ============================================
// Log scan results
// ============================================
async function logScan(
  articlesFound: number,
  incidentsAdded: number,
  errors: string | null,
  durationMs: number,
  sources: { rss: number; google: number; telegram: number }
) {
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
        sources_breakdown: JSON.stringify(sources),
      }),
    });
  } catch {}
}

// ============================================
// MAIN: GET handler (cron + manual trigger)
// ============================================
export async function GET(request: Request) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log("Scan triggered without cron secret (manual)");
  }

  const sourceCounts = { rss: 0, google: 0, telegram: 0, twitter: 0, facebook: 0 };

  try {
    // 1. Fetch all sources in parallel
    const [rssResults, googleResults, telegramResults, twitterResults, facebookResults] = await Promise.all([
      Promise.all(RSS_FEEDS.map(fetchRSS)),
      fetchGoogleNews(),
      fetchTelegram(),
      fetchTwitter(),
      fetchFacebook(),
    ]);

    const rssArticles = rssResults.flat();
    sourceCounts.rss = rssArticles.length;
    sourceCounts.google = googleResults.length;
    sourceCounts.telegram = telegramResults.length;
    sourceCounts.twitter = twitterResults.length;
    sourceCounts.facebook = facebookResults.length;

    const allArticles = [...rssArticles, ...googleResults, ...telegramResults, ...twitterResults, ...facebookResults];

    // Deduplicate across sources by title similarity
    const seen = new Set<string>();
    const uniqueArticles = allArticles.filter(item => {
      try {
        const parsed = JSON.parse(item);
        const key = parsed.title.substring(0, 50).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      } catch {
        return true;
      }
    });

    if (uniqueArticles.length === 0) {
      const duration = Date.now() - startTime;
      await logScan(0, 0, null, duration, sourceCounts);
      return Response.json({
        status: "ok",
        message: "No relevant articles found",
        sources: sourceCounts,
        scanned: 0,
        detected: 0,
        inserted: 0,
        duration_ms: duration,
      });
    }

    // 2. Analyze with Gemini (batch up to 10)
    const allIncidents: any[] = [];
    for (let i = 0; i < uniqueArticles.length; i += 10) {
      const batch = uniqueArticles.slice(i, i + 10);
      const incidents = await analyzeWithGemini(batch);
      allIncidents.push(...incidents);
    }

    // 3. Insert to Supabase with dedup
    const { inserted, newIncidents } = await insertToSupabase(allIncidents);

    // 4. Send push notifications for new incidents
    if (newIncidents.length > 0) {
      await sendPushNotifications(newIncidents);
    }

    const duration = Date.now() - startTime;
    await logScan(uniqueArticles.length, inserted, null, duration, sourceCounts);

    return Response.json({
      status: "ok",
      sources: sourceCounts,
      scanned: uniqueArticles.length,
      detected: allIncidents.length,
      inserted,
      notified: newIncidents.length,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    const duration = Date.now() - startTime;
    await logScan(0, 0, e.message, duration, sourceCounts);
    return Response.json({ status: "error", message: e.message, duration_ms: duration }, { status: 500 });
  }
}
