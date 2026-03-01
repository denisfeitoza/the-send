import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export async function POST(req: NextRequest) {
    try {
        const { text, sourceLang, targetLang } = await req.json();

        if (!text || !targetLang) {
            return NextResponse.json({ error: "Missing text or targetLang" }, { status: 400 });
        }

        const langNames: Record<string, string> = {
            auto: "auto-detect",
            ar: "Arabic", "ar-SA": "Arabic (Saudi)", "ar-AE": "Arabic (Gulf/UAE)",
            "ar-EG": "Arabic (Egyptian)", "ar-LB": "Arabic (Levantine)", "ar-MA": "Arabic (Moroccan)",
            en: "English", "en-US": "English (US)", "en-GB": "English (UK)",
            es: "Spanish", pt: "Portuguese (Brazilian)",
            fr: "French", de: "German", it: "Italian",
            zh: "Chinese", ja: "Japanese", ko: "Korean",
            ru: "Russian", hi: "Hindi", tr: "Turkish",
        };

        const sourceLabel = langNames[sourceLang] || sourceLang || "auto-detect";
        const targetLabel = langNames[targetLang] || targetLang;

        const systemPrompt = `You are an expert real-time interpreter providing live translation during a conversation.

YOUR TASK: Translate the spoken text ${sourceLabel !== "auto-detect" ? `from ${sourceLabel} ` : ""}into ${targetLabel}.

CRITICAL RULES:
1. Output ONLY the translated text — no explanations, labels, notes, quotation marks, or meta-commentary.
2. Preserve the speaker's original meaning, tone, and intent as faithfully as possible.
3. For informal or conversational speech, use natural colloquial ${targetLabel} — not stiff/formal language.
4. If the text is already in ${targetLabel}, return it unchanged.
5. For proper nouns (names, places, brands), keep them in their original form unless there's a well-known ${targetLabel} equivalent.
6. Handle incomplete sentences or speech fragments gracefully — translate what's there without adding missing context.
7. For Arabic dialects, understand that the speaker may mix Modern Standard Arabic with dialect — translate the meaning, not word-by-word.`;

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
                temperature: 0.1,
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("[Translate API] OpenRouter error:", errorData);
            return NextResponse.json({ error: "Translation failed" }, { status: 500 });
        }

        const data = await response.json();
        const translatedText = data.choices?.[0]?.message?.content?.trim() || "";

        return NextResponse.json({ translatedText });
    } catch (error: any) {
        console.error("[Translate API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
