export const runtime = "edge";

export async function GET() {
  const key = process.env.GEMINI_API_KEY || "MISSING";
  
  if (key === "MISSING") {
    return Response.json({ error: "GEMINI_API_KEY not set" });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "רשום 3 אירועי שריפות סוללות ליתיום מאופניים חשמליים שקרו בישראל ב-2024. החזר JSON array עם incident_date, city, description. בלי markdown." }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      }
    );

    const status = res.status;
    const body = await res.text();
    
    return Response.json({ 
      gemini_status: status, 
      key_prefix: key.substring(0, 10) + "...",
      raw_response: body.substring(0, 2000)
    });
  } catch (e: any) {
    return Response.json({ error: e.message });
  }
}
```

4. **Commit**

חכה דקה ואז גלוש ל:
```
https://lithium-fire-dashboard.vercel.app/api/test-gemini
