// app/api/scan/route.ts
// Scans Israeli news RSS feeds for lithium battery fire incidents using Gemini AI
// Stores verified incidents in Supabase

export const runtime = "edge";
export const maxDuration = 60;

const SUPABASE_URL = "https://dmgxvcvjzgmorfibvezr.supabase.co";
const SUPABASE_KEY = "sb_publishable_PIU3wfCGDqkJo0KnQKaCIw_U4wdL8s0";
const GEMINI_KEY = "AIzaSyDwGHBj2-idFHmJVsWALJzwHuZKTlw2jpg";

// Israeli news RSS feeds
const RSS_FEEDS = [
  "https://www.ynet.co.il/Integration/StoryRss2.xml",
  "https://rss.walla.co.il/feed/1",
  "https://www.maariv.co.il/Rss/RssFeedsMivzakChadashot",
  "https://www.israelhayom.co.il/rss",
];

// Keywords to pre-filter relevant articles
const KEYWORDS = [
  "סוללת ליתיום", "סוללת ליתיום-יון", "ליתיום", "אופניים חשמליים",
  "קורקינט חשמלי", "קורקינט", "רכב חשמלי", "קלנועית",
  "סוללה התלקחה", "סוללה התפוצצה", "התלקחות סוללה", "פיצוץ סוללה",
  "טעינת סוללה", "בריחה תרמית", "thermal runaway",
  "שריפה.*אופניים", "שריפה.*קורקינט", "שריפה.*סוללה",
  "אופניים.*שריפה", "קורקינט.*שריפה", "סוללה.*שריפה",
  "אופניים.*בוערים", "סוללה.*בוערת", "מטען.*התלקח",
  "פאוורבנק", "powerbank", "UPS.*שריפה", "מתקן אגירה",
];

async function fetchRSS(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();
    
    // Extract titles and descriptions from RSS XML
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
      const hasKeyword = KEYWORDS.some(kw => {
        if (kw.includes(".*")) {
          const parts = kw.split(".*");
          return parts.every(p => combined.includes(p));
        }
        return combined.includes(kw);
      });
      
      if (hasKeyword) {
        items.push(JSON.stringify({ title, desc: desc.substring(0, 500), link, pubDate }));
      }
    }
    return items;
  } catch {
    return [];
  }
}

async function analyzeWithGemini(articles: string[]): Promise<any[]> {
  const prompt = `אתה מנתח חדשות שריפות סוללות ליתיום בישראל.

כללים חשובים:
- כלול רק: שריפה/פיצוץ/התלקחות של סוללת ליתיום יון
- כלול: אופניים חשמליים, קורקינט, רכב חשמלי, קלנועית, טלפון, פאוורבנק, UPS, מתקן אגירה
- לא כלול: תאונת דרכים בלבד (אלא אם הסוללה נדלקה), גניבה, מכירות, חקיקה, כתבות כלליות
- לא כלול: שריפה רגילה שלא קשורה לסוללת ליתיום

עבור כל כתבה, החזר JSON array. אם אין אירועים רלוונטיים, החזר [].

פורמט לכל אירוע:
{
  "date": "YYYY-MM-DD",
  "city": "שם העיר",
  "district": "דן/מרכז/חיפה/ירושלים/דרום/צפון/יו\"ש",
  "device_type": "אופניים חשמליים/קורקינט/רכב חשמלי/קלנועית/טלפון / טאבלט/סוללת גיבוי / UPS / פאוורבנק/מתקן אגירה (ESS)/אחר",
  "severity": "קלה/בינונית/קשה/קטלנית",
  "deaths": 0,
  "injuries": 0,
  "description": "תיאור קצר בעברית",
  "source": "שם המקור",
  "source_url": "קישור"
}

הכתבות:
${articles.join("\n\n")}

החזר רק JSON array, בלי שום טקסט נוסף.`;

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
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

async function insertToSupabase(incidents: any[]): Promise<number> {
  if (!incidents.length) return 0;
  
  let inserted = 0;
  for (const inc of incidents) {
    try {
      // Check for duplicates by date + city + device_type
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/incidents?date=eq.${inc.date}&city=eq.${encodeURIComponent(inc.city)}&device_type=eq.${encodeURIComponent(inc.device_type)}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      
      const existing = await checkRes.json();
      if (existing.length > 0) continue; // Skip duplicate
      
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/incidents`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          date: inc.date,
          city: inc.city,
          district: inc.district || null,
          device_type: inc.device_type,
          severity: inc.severity || "בינונית",
          deaths: inc.deaths || 0,
          injuries: inc.injuries || 0,
          description: inc.description,
          source: inc.source,
          source_url: inc.source_url,
        }),
      });
      
      if (insertRes.ok) inserted++;
    } catch {
      continue;
    }
  }
  return inserted;
}

export async function GET() {
  try {
    // 1. Fetch all RSS feeds
    const allArticles: string[] = [];
    for (const feed of RSS_FEEDS) {
      const articles = await fetchRSS(feed);
      allArticles.push(...articles);
    }

    if (allArticles.length === 0) {
      return Response.json({ status: "ok", message: "No relevant articles found", scanned: 0, inserted: 0 });
    }

    // 2. Analyze with Gemini (batch up to 10 articles at a time)
    const allIncidents: any[] = [];
    for (let i = 0; i < allArticles.length; i += 10) {
      const batch = allArticles.slice(i, i + 10);
      const incidents = await analyzeWithGemini(batch);
      allIncidents.push(...incidents);
    }

    // 3. Insert to Supabase (with dedup)
    const inserted = await insertToSupabase(allIncidents);

    return Response.json({
      status: "ok",
      scanned: allArticles.length,
      detected: allIncidents.length,
      inserted,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return Response.json({ status: "error", message: e.message }, { status: 500 });
  }
}
