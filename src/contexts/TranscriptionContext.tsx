"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────
export interface TranscriptEntry {
    id: string;
    text: string;
    timestamp: Date;
}

export interface TranslationEntry {
    id: string;
    transcriptId: string;
    text: string;
    timestamp: Date;
}

export type SupportedLanguage = "auto" | "ar" | "ar-EG" | "ar-AE" | "ar-SA" | "ar-LB" | "ar-MA" | "en" | "es" | "pt" | "fr" | "de" | "it" | "zh" | "ja" | "ko" | "ru" | "hi" | "tr";

export type STTEngine = "browser" | "groq";

export type ApiStatus = {
    groq: "idle" | "recording" | "sending" | "processing";
    translation: "idle" | "sending";
    summary: "idle" | "sending";
};

export const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string; speechCode?: string }[] = [
    { value: "auto", label: "🌐 Auto Detect" },
    { value: "ar", label: "🇸🇦 Arabic (MSA)", speechCode: "ar" },
    { value: "ar-EG", label: "🇪🇬 Arabic (Egyptian)", speechCode: "ar-EG" },
    { value: "ar-AE", label: "🇦🇪 Arabic (Gulf/UAE)", speechCode: "ar-AE" },
    { value: "ar-SA", label: "🇸🇦 Arabic (Saudi)", speechCode: "ar-SA" },
    { value: "ar-LB", label: "🇱🇧 Arabic (Levantine)", speechCode: "ar-LB" },
    { value: "ar-MA", label: "🇲🇦 Arabic (Moroccan)", speechCode: "ar-MA" },
    { value: "en", label: "🇺🇸 English", speechCode: "en-US" },
    { value: "es", label: "🇪🇸 Spanish", speechCode: "es-ES" },
    { value: "pt", label: "🇧🇷 Portuguese", speechCode: "pt-BR" },
    { value: "fr", label: "🇫🇷 French", speechCode: "fr-FR" },
    { value: "de", label: "🇩🇪 German", speechCode: "de-DE" },
    { value: "it", label: "🇮🇹 Italian", speechCode: "it-IT" },
    { value: "zh", label: "🇨🇳 Chinese", speechCode: "zh-CN" },
    { value: "ja", label: "🇯🇵 Japanese", speechCode: "ja-JP" },
    { value: "ko", label: "🇰🇷 Korean", speechCode: "ko-KR" },
    { value: "ru", label: "🇷🇺 Russian", speechCode: "ru-RU" },
    { value: "hi", label: "🇮🇳 Hindi", speechCode: "hi-IN" },
    { value: "tr", label: "🇹🇷 Turkish", speechCode: "tr-TR" },
];

export const LANGUAGE_NAMES: Record<string, string> = {
    auto: "Auto Detect",
    ar: "Arabic",
    "ar-EG": "Arabic (Egyptian)",
    "ar-AE": "Arabic (Gulf/UAE)",
    "ar-SA": "Arabic (Saudi)",
    "ar-LB": "Arabic (Levantine)",
    "ar-MA": "Arabic (Moroccan)",
    en: "English",
    es: "Spanish",
    pt: "Portuguese",
    fr: "French",
    de: "German",
    it: "Italian",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    hi: "Hindi",
    tr: "Turkish",
};

// ─── Context Interface ────────────────────────────────────
interface LiveTranslatorContextValue {
    // Engine
    sttEngine: STTEngine;
    setSTTEngine: (engine: STTEngine) => void;

    // Language settings
    sourceLang: SupportedLanguage;
    setSourceLang: (lang: SupportedLanguage) => void;
    targetLang: SupportedLanguage;
    setTargetLang: (lang: SupportedLanguage) => void;

    // Interval
    intervalSeconds: number;
    setIntervalSeconds: (secs: number) => void;

    // Recording state
    isListening: boolean;
    startListening: () => void;
    stopListening: () => void;

    // Data
    transcripts: TranscriptEntry[];
    translations: TranslationEntry[];
    pendingText: string;

    // Actions
    isTranslating: boolean;
    flashTranslate: () => Promise<void>;
    clearScreen: () => void;

    // API Status (visual feedback)
    apiStatus: ApiStatus;

    // Summary
    summary: string;
    isSummarizing: boolean;
    generateSummary: () => Promise<void>;
    clearSummary: () => void;

    // Download
    downloadTranscript: () => void;
}

const LiveTranslatorContext = createContext<LiveTranslatorContextValue | null>(null);

export const useLiveTranslator = () => {
    const context = useContext(LiveTranslatorContext);
    if (!context) throw new Error("useLiveTranslator must be used within a LiveTranslatorProvider");
    return context;
};

// ─── Provider ─────────────────────────────────────────────
export const LiveTranslatorProvider = ({ children }: { children: React.ReactNode }) => {
    const [sttEngine, setSTTEngine] = useState<STTEngine>("groq");
    const [sourceLang, setSourceLang] = useState<SupportedLanguage>("ar-AE");
    const [targetLang, setTargetLang] = useState<SupportedLanguage>("pt");
    const [intervalSeconds, setIntervalSeconds] = useState(8);
    const [isListening, setIsListening] = useState(false);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [translations, setTranslations] = useState<TranslationEntry[]>([]);
    const [pendingText, setPendingText] = useState("");
    const [isTranslating, setIsTranslating] = useState(false);
    const [summary, setSummary] = useState("");
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [apiStatus, setApiStatus] = useState<ApiStatus>({
        groq: "idle",
        translation: "idle",
        summary: "idle",
    });

    const recognitionRef = useRef<any>(null);
    const pendingBufferRef = useRef("");
    const autoTranslateTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isListeningRef = useRef(false);
    const audioStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const groqTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sttEngineRef = useRef<STTEngine>(sttEngine);
    const intervalSecondsRef = useRef(intervalSeconds);

    // Keep refs in sync
    useEffect(() => {
        isListeningRef.current = isListening;
    }, [isListening]);

    useEffect(() => {
        sttEngineRef.current = sttEngine;
    }, [sttEngine]);

    useEffect(() => {
        intervalSecondsRef.current = intervalSeconds;
    }, [intervalSeconds]);

    // ─── Translation API call ──────────────────────────
    const translateText = useCallback(async (text: string, previousContext?: string[]): Promise<string> => {
        setApiStatus(prev => ({ ...prev, translation: "sending" }));
        try {
            const res = await fetch("/api/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, sourceLang, targetLang, previousContext }),
            });
            if (!res.ok) throw new Error("Translation request failed");
            const data = await res.json();
            return data.translatedText || "";
        } finally {
            setApiStatus(prev => ({ ...prev, translation: "idle" }));
        }
    }, [sourceLang, targetLang]);

    // ─── Process and translate pending buffer ──────────
    const processBuffer = useCallback(async () => {
        const text = pendingBufferRef.current.trim();
        if (!text) return;

        // Create transcript entry
        const transcriptId = crypto.randomUUID();
        const entry: TranscriptEntry = {
            id: transcriptId,
            text,
            timestamp: new Date(),
        };
        setTranscripts(prev => [...prev, entry]);
        pendingBufferRef.current = "";
        setPendingText("");

        // Translate with last 2 translations as context
        setIsTranslating(true);
        try {
            const recentContext = translations.slice(-2).map(t => t.text);
            const translated = await translateText(text, recentContext);
            if (translated) {
                setTranslations(prev => [...prev, {
                    id: crypto.randomUUID(),
                    transcriptId,
                    text: translated,
                    timestamp: new Date(),
                }]);
            }
        } catch (err) {
            console.error("[LiveTranslator] Translation error:", err);
        } finally {
            setIsTranslating(false);
        }
    }, [translateText, translations]);

    // ─── Auto-translate timer ─────────────────────────
    useEffect(() => {
        if (!isListening) {
            if (autoTranslateTimerRef.current) {
                clearInterval(autoTranslateTimerRef.current);
                autoTranslateTimerRef.current = null;
            }
            return;
        }

        autoTranslateTimerRef.current = setInterval(() => {
            processBuffer();
        }, intervalSeconds * 1000);

        return () => {
            if (autoTranslateTimerRef.current) {
                clearInterval(autoTranslateTimerRef.current);
                autoTranslateTimerRef.current = null;
            }
        };
    }, [isListening, intervalSeconds, processBuffer]);

    // ═══════════════════════════════════════════════════
    // ─── BROWSER Speech Recognition (Web Speech API) ──
    // ═══════════════════════════════════════════════════
    const startBrowserListening = useCallback(async () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Speech Recognition. Use Chrome or Edge.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;

        if (sourceLang === "auto") {
            recognition.lang = "";
        } else {
            const langOption = LANGUAGE_OPTIONS.find(l => l.value === sourceLang);
            recognition.lang = langOption?.speechCode || sourceLang;
        }

        recognition.onresult = (event: any) => {
            let interimTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                let bestAlternative = result[0];
                for (let j = 1; j < result.length; j++) {
                    if (result[j].confidence > bestAlternative.confidence) {
                        bestAlternative = result[j];
                    }
                }
                const transcript = bestAlternative.transcript;
                if (result.isFinal) {
                    pendingBufferRef.current += transcript + " ";
                } else {
                    interimTranscript += transcript;
                }
            }
            setPendingText(pendingBufferRef.current + interimTranscript);
        };

        let lastErrorTime = 0;
        let consecutiveErrors = 0;

        recognition.onerror = (event: any) => {
            if (event.error === "not-allowed") {
                alert("Microphone access denied.");
                setIsListening(false);
                return;
            }
            if (event.error === "aborted") return;
            if (event.error === "no-speech") {
                consecutiveErrors = 0;
                return;
            }

            console.warn("[SpeechRecognition] Error:", event.error);
            const now = Date.now();
            if (now - lastErrorTime < 5000) {
                consecutiveErrors++;
            } else {
                consecutiveErrors = 1;
            }
            lastErrorTime = now;

            if (consecutiveErrors >= 10) {
                alert("Speech recognition having persistent issues. Check internet/mic.");
                setIsListening(false);
                return;
            }
        };

        recognition.onend = () => {
            if (isListeningRef.current && sttEngineRef.current === "browser") {
                const delay = consecutiveErrors > 0 ? 500 * consecutiveErrors : 50;
                setTimeout(() => {
                    if (isListeningRef.current && recognitionRef.current === recognition) {
                        try { recognition.start(); } catch (e) { /* ignore */ }
                    }
                }, delay);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        pendingBufferRef.current = "";
        setPendingText("");
    }, [sourceLang]);

    // ═══════════════════════════════════════════════════
    // ─── GROQ Speech Recognition (Whisper API) ────────
    // ═══════════════════════════════════════════════════
    const sendAudioToGroq = useCallback(async (audioBlob: Blob) => {
        console.log(`[Groq] Received audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        if (audioBlob.size < 100) {
            console.log("[Groq] Audio too small, skipping");
            return;
        }

        setApiStatus(prev => ({ ...prev, groq: "sending" }));

        try {
            const formData = new FormData();
            formData.append("audio", audioBlob, "audio.webm");

            const langCode = sourceLang === "auto" ? "auto" : sourceLang.split("-")[0];
            formData.append("language", langCode);

            console.log(`[Groq] Sending to /api/transcribe, lang: ${langCode}`);
            setApiStatus(prev => ({ ...prev, groq: "processing" }));
            const res = await fetch("/api/transcribe", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                console.error("[Groq STT] Failed:", res.status, err);
                return;
            }

            const data = await res.json();
            console.log("[Groq] Transcription result:", data);
            const text = (data.text || "").trim();
            if (!text) return;

            // IMMEDIATELY create transcript entry (shows as solid, not faded)
            const transcriptId = crypto.randomUUID();
            setTranscripts(prev => [...prev, {
                id: transcriptId,
                text,
                timestamp: new Date(),
            }]);

            // IMMEDIATELY start translating with last 2 translations as context
            setIsTranslating(true);
            try {
                // Grab last 2 translations for conversational context
                const recentContext = translations.slice(-2).map(t => t.text);
                const translated = await translateText(text, recentContext);
                if (translated) {
                    setTranslations(prev => [...prev, {
                        id: crypto.randomUUID(),
                        transcriptId,
                        text: translated,
                        timestamp: new Date(),
                    }]);
                }
            } catch (err) {
                console.error("[Groq] Translation error:", err);
            } finally {
                setIsTranslating(false);
            }
        } catch (err) {
            console.error("[Groq STT] Error:", err);
        } finally {
            setApiStatus(prev => ({ ...prev, groq: "idle" }));
        }
    }, [sourceLang, translateText, translations]);

    const startGroqListening = useCallback(async () => {
        try {
            console.log("[Groq] Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: true,
                    channelCount: 1,
                },
            });
            audioStreamRef.current = stream;
            console.log("[Groq] Microphone access granted, tracks:", stream.getAudioTracks().length);

            // Set listening BEFORE starting recorder (critical: ref must be true)
            isListeningRef.current = true;
            setIsListening(true);
            pendingBufferRef.current = "";
            setPendingText("");

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";

            // Overlapping dual-recorder: next starts BEFORE current stops = ZERO gap
            const OVERLAP_MS = 300;
            const MIN_BLOB_SIZE = 1000;

            const startRecordingCycle = () => {
                if (!isListeningRef.current || sttEngineRef.current !== "groq") return;

                const tracks = stream.getAudioTracks();
                if (!tracks.length || tracks[0].readyState !== "live") {
                    console.warn("[Groq] Stream track not alive, stopping");
                    return;
                }

                try {
                    const recorder = new MediaRecorder(stream, { mimeType });
                    const chunks: Blob[] = [];

                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) chunks.push(e.data);
                    };

                    recorder.onstop = () => {
                        if (chunks.length > 0) {
                            const blob = new Blob(chunks, { type: mimeType });
                            if (blob.size >= MIN_BLOB_SIZE) {
                                console.log(`[Groq] 📤 Sending ${chunks.length} chunks, ${blob.size} bytes`);
                                sendAudioToGroq(blob);
                            } else {
                                console.log(`[Groq] ⏭️ Skipping tiny blob (${blob.size} bytes)`);
                            }
                        }
                    };

                    recorder.start(1000);
                    mediaRecorderRef.current = recorder;
                    setApiStatus(prev => ({ ...prev, groq: "recording" }));
                    const currentInterval = intervalSecondsRef.current;
                    console.log(`[Groq] 🎙️ Recording cycle started (${currentInterval}s)`);

                    const stopDelay = Math.max(currentInterval * 1000 - OVERLAP_MS, 500);

                    groqTimerRef.current = setTimeout(() => {
                        if (!isListeningRef.current || sttEngineRef.current !== "groq") {
                            if (recorder.state === "recording") recorder.stop();
                            return;
                        }
                        // START next recorder FIRST (overlap)
                        startRecordingCycle();
                        // THEN stop current after overlap
                        setTimeout(() => {
                            if (recorder.state === "recording") recorder.stop();
                        }, OVERLAP_MS);
                    }, stopDelay);
                } catch (err) {
                    console.warn("[Groq] MediaRecorder start failed, retrying in 200ms:", err);
                    setTimeout(startRecordingCycle, 200);
                }
            };

            startRecordingCycle();

        } catch (err: any) {
            console.error("[Groq] Mic access error:", err);
            alert("Could not access microphone: " + err.message);
        }
    }, [sourceLang, intervalSeconds, sendAudioToGroq]);

    // ─── Unified Start/Stop ──────────────────────────
    const startListening = useCallback(() => {
        if (sttEngine === "groq") {
            startGroqListening();
        } else {
            startBrowserListening();
        }
    }, [sttEngine, startBrowserListening, startGroqListening]);

    const stopListening = useCallback(() => {
        isListeningRef.current = false;
        setIsListening(false);
        setApiStatus(prev => ({ ...prev, groq: "idle" }));

        // Stop browser recognition
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        // Stop Groq recorder & timer
        if (groqTimerRef.current) {
            clearTimeout(groqTimerRef.current);
            groqTimerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;

        // Clean up audio
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(t => t.stop());
            audioStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Process remaining buffer
        if (pendingBufferRef.current.trim()) {
            processBuffer();
        }
    }, [processBuffer]);

    // ─── Flash Translate ─────────────────────────────
    const flashTranslate = useCallback(async () => {
        // If using Groq, wait for any pending Groq processing
        if (sttEngine === "groq") {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        await processBuffer();
    }, [processBuffer, sttEngine]);

    // ─── Clear Screen ────────────────────────────────
    const clearScreen = useCallback(() => {
        setTranscripts([]);
        setTranslations([]);
        setPendingText("");
        pendingBufferRef.current = "";
    }, []);

    // ─── Summary ─────────────────────────────────────
    const generateSummary = useCallback(async () => {
        const allText = transcripts.map(t => t.text).join(" ");
        if (!allText.trim()) return;

        setIsSummarizing(true);
        setApiStatus(prev => ({ ...prev, summary: "sending" }));
        try {
            const res = await fetch("/api/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: allText, language: LANGUAGE_NAMES[targetLang] || "Portuguese" }),
            });
            if (!res.ok) throw new Error("Summary request failed");
            const data = await res.json();
            setSummary(data.summary || "");
        } catch (err) {
            console.error("[LiveTranslator] Summary error:", err);
        } finally {
            setIsSummarizing(false);
            setApiStatus(prev => ({ ...prev, summary: "idle" }));
        }
    }, [transcripts, targetLang]);

    const clearSummary = useCallback(() => setSummary(""), []);

    // ─── Download ────────────────────────────────────
    const downloadTranscript = useCallback(() => {
        const lines: string[] = [];
        lines.push("=== LIVE TRANSCRIPTION & TRANSLATION ===\n");
        lines.push(`Source: ${LANGUAGE_NAMES[sourceLang]} → Target: ${LANGUAGE_NAMES[targetLang]}\n`);
        lines.push(`Engine: ${sttEngine === "groq" ? "Groq Whisper" : "Web Speech API"}\n`);
        lines.push("─".repeat(50) + "\n");

        transcripts.forEach(t => {
            const translation = translations.find(tr => tr.transcriptId === t.id);
            lines.push(`[${t.timestamp.toLocaleTimeString()}] ORIGINAL:`);
            lines.push(t.text);
            if (translation) {
                lines.push(`\n[${translation.timestamp.toLocaleTimeString()}] TRANSLATION:`);
                lines.push(translation.text);
            }
            lines.push("\n" + "─".repeat(50) + "\n");
        });

        if (summary) {
            lines.push("\n=== SUMMARY ===\n");
            lines.push(summary);
        }

        const blob = new Blob([lines.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translation-${new Date().toISOString().slice(0, 19)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [transcripts, translations, summary, sourceLang, targetLang, sttEngine]);

    return (
        <LiveTranslatorContext.Provider value={{
            sttEngine, setSTTEngine,
            sourceLang, setSourceLang,
            targetLang, setTargetLang,
            intervalSeconds, setIntervalSeconds,
            isListening, startListening, stopListening,
            transcripts, translations, pendingText,
            isTranslating, flashTranslate,
            clearScreen,
            apiStatus,
            summary, isSummarizing, generateSummary, clearSummary,
            downloadTranscript,
        }}>
            {children}
        </LiveTranslatorContext.Provider>
    );
};
