import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// Common Whisper hallucination patterns to filter out
const HALLUCINATION_PATTERNS = [
    /^(obrigad[oa]|thanks?\s+for\s+watching|thank\s+you)/i,
    /tradução\s+de/i,
    /legendas?\s+(por|by)/i,
    /subtitl(es?|ed)\s+by/i,
    /^\.+$/,
    /^\s*$/,
    /inscreva-se/i,
    /subscribe/i,
    /^(you|you\.)$/i,
    /continue\s+to\s+play/i,
    /this\s+information\s+is\s+available/i,
    // Arabic hallucination patterns
    /ترجمة/,           // "translation"
    /نانسي/,           // "Nancy" (common Whisper hallucination name)
    /قنقر|قنقور/,      // "Qanqour" 
    /شكرا للمشاهدة/,   // "thanks for watching"
    /اشترك/,           // "subscribe"
    /أعجبني/,          // "like"
    /السلام عليكم$/,   // just "salam" with nothing else
];

function isHallucination(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;
    return HALLUCINATION_PATTERNS.some(p => p.test(trimmed));
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File | null;
        const language = formData.get("language") as string | null;

        if (!audioFile) {
            return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
        }

        console.log(`[Groq STT] Audio: ${audioFile.size} bytes, type: ${audioFile.type}, lang: ${language}`);

        if (!GROQ_API_KEY) {
            return NextResponse.json({ error: "Groq API key not configured. Set GROQ_API_KEY env variable." }, { status: 500 });
        }

        // Build Groq API form data — pass the original File directly (no re-encoding!)
        const groqFormData = new FormData();
        groqFormData.append("file", audioFile, "audio.webm");
        groqFormData.append("model", "whisper-large-v3-turbo");
        groqFormData.append("response_format", "verbose_json");
        groqFormData.append("temperature", "0.0");

        // Anti-hallucination prompt
        groqFormData.append("prompt", "");

        // Set language hint for better accuracy
        if (language && language !== "auto") {
            const langCode = language.split("-")[0];
            groqFormData.append("language", langCode);
        }

        const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: groqFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Groq STT] API Error:", response.status, errorText);
            return NextResponse.json({ error: "Transcription failed", details: errorText }, { status: response.status });
        }

        const data = await response.json();
        const rawText = data.text || "";

        // Filter hallucinations
        if (isHallucination(rawText)) {
            console.log(`[Groq STT] Filtered hallucination: "${rawText}"`);
            return NextResponse.json({ text: "", language: data.language || "", duration: data.duration || 0, segments: [] });
        }

        // Filter by no_speech_prob if available in segments
        const validSegments = (data.segments || []).filter(
            (s: any) => (s.no_speech_prob ?? 0) < 0.7
        );
        const filteredText = validSegments.length > 0
            ? validSegments.map((s: any) => s.text).join("").trim()
            : rawText;

        if (!filteredText || isHallucination(filteredText)) {
            console.log(`[Groq STT] Filtered after segment analysis: "${filteredText}"`);
            return NextResponse.json({ text: "", language: data.language || "", duration: data.duration || 0, segments: [] });
        }

        console.log(`[Groq STT] ✓ "${filteredText.substring(0, 80)}..." lang:${data.language} dur:${data.duration}s`);

        return NextResponse.json({
            text: filteredText,
            language: data.language || "",
            duration: data.duration || 0,
            segments: validSegments,
        });
    } catch (error: any) {
        console.error("[Groq STT] Server error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
