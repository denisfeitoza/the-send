import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export async function POST(req: NextRequest) {
    try {
        const { text, language } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Missing conversation text" }, { status: 400 });
        }

        const langLabel = language || "Portuguese";

        const systemPrompt = `You are a conversation analyst. Analyze the following conversation transcript and produce a structured summary in ${langLabel}.

Output format:
## Summary
A brief 2-3 sentence overview of the conversation.

## Key Points
- Bullet point 1
- Bullet point 2
- Bullet point 3
(as many as needed)

## Action Items (if any)
- Action item 1
- Action item 2

Rules:
- Be concise and precise.
- Focus on the most important information.
- Use bullet points for clarity.
- Write the summary in ${langLabel}.`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text },
                ],
                max_tokens: 4096,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Summary API] OpenRouter error:", errorData);
            return NextResponse.json({ error: "Summary generation failed" }, { status: 500 });
        }

        const data = await response.json();
        const summary = data.choices?.[0]?.message?.content?.trim() || "";

        return NextResponse.json({ summary });
    } catch (error: any) {
        console.error("[Summary API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
