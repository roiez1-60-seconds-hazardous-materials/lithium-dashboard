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
          contents: [{ parts: [{ text: "List 3 lithium battery fire incidents in Israel in 2024. Return JSON array with incident_date, city, description. No markdown." }] }],
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

**Commit** → חכה דקה → נסה:
```
https://lithium-fire-dashboard.vercel.app/api/test-gemini
