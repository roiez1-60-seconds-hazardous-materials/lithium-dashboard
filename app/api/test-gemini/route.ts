// app/api/test-gemini/route.ts
export const runtime = "edge";

export async function GET() {
  const key = process.env.GEMINI_API_KEY || "NOT_SET";
  const keyPreview = key.substring(0, 12) + "..." + key.substring(key.length - 4);
  
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say hello in Hebrew" }] }],
        }),
      }
    );
    
    const status = res.status;
    const body = await res.text();
    
    return Response.json({
      key_preview: keyPreview,
      api_status: status,
      api_response: body.substring(0, 500),
    });
  } catch (e: any) {
    return Response.json({
      key_preview: keyPreview,
      error: e.message,
    });
  }
}
