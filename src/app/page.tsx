"use client";

import { useLiveTranslator, LANGUAGE_OPTIONS, SupportedLanguage, STTEngine, ApiStatus } from "@/contexts/TranscriptionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Download,
  Zap,
  Trash2,
  FileText,
  Loader2,
  Languages,
  ArrowRight,
  X,
  Clock,
  ChevronDown,
  Cpu,
  Globe,
  Settings,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

export default function LiveTranslatorPage() {
  const {
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
  } = useLiveTranslator();

  const [showSettings, setShowSettings] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [mobileView, setMobileView] = useState<"translation" | "transcription">("translation");
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const translationEndRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const translationScrollRef = useRef<HTMLDivElement>(null);
  const [transcriptAtBottom, setTranscriptAtBottom] = useState(true);
  const [translationAtBottom, setTranslationAtBottom] = useState(true);

  // Check if a scroll container is near bottom
  const isNearBottom = (el: HTMLElement) => {
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Track scroll position for transcription panel
  const onTranscriptScroll = useCallback(() => {
    if (transcriptScrollRef.current) {
      setTranscriptAtBottom(isNearBottom(transcriptScrollRef.current));
    }
  }, []);

  // Track scroll position for translation panel
  const onTranslationScroll = useCallback(() => {
    if (translationScrollRef.current) {
      setTranslationAtBottom(isNearBottom(translationScrollRef.current));
    }
  }, []);

  // Smart auto-scroll: only if user is at bottom
  useEffect(() => {
    if (transcriptAtBottom) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, pendingText, transcriptAtBottom]);

  useEffect(() => {
    if (translationAtBottom) {
      translationEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [translations, translationAtBottom]);

  // Show summary modal when generated
  useEffect(() => {
    if (summary) setShowSummary(true);
  }, [summary]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#0a0a1a] text-slate-50 flex flex-col">
      {/* ─── Header ─────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#0d0d24]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isListening ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50" : "bg-slate-600"}`} />
            <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent truncate">
              <span className="sm:hidden">AI Translator</span>
              <span className="hidden sm:inline">AI Translator — Live Speech Translation</span>
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {isListening && (
              <span className="text-[10px] text-red-400 font-mono animate-pulse">● REC</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-slate-400 hover:text-white h-8 px-2"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Settings</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Settings Panel (collapsible) ─────────────────── */}
      {showSettings && (
        <div className="border-b border-white/5 bg-[#0d0d24]/60 backdrop-blur-sm">
          <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-3">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
              {/* STT Engine Toggle */}
              <div className="col-span-2 flex items-center gap-2">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Engine</label>
                <div className="flex bg-slate-800/50 border border-white/10 rounded-lg p-0.5 flex-1 sm:flex-none">
                  <button
                    onClick={() => setSTTEngine("browser")}
                    disabled={isListening}
                    className={`flex items-center justify-center gap-1 flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sttEngine === "browser"
                      ? "bg-violet-600 text-white shadow-lg" : "text-slate-400"
                      } disabled:opacity-60`}
                  >
                    <Globe className="w-3 h-3" /> Browser
                  </button>
                  <button
                    onClick={() => setSTTEngine("groq")}
                    disabled={isListening}
                    className={`flex items-center justify-center gap-1 flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${sttEngine === "groq"
                      ? "bg-orange-500 text-black shadow-lg" : "text-slate-400"
                      } disabled:opacity-60`}
                  >
                    <Cpu className="w-3 h-3" /> Groq
                  </button>
                </div>
              </div>

              {/* Languages */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">From</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value as SupportedLanguage)}
                  className="bg-slate-800/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-full"
                  disabled={isListening}
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">To</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value as SupportedLanguage)}
                  className="bg-slate-800/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 w-full"
                >
                  {LANGUAGE_OPTIONS.filter(l => l.value !== "auto").map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>

              {/* Interval */}
              <div className="col-span-2 flex items-center gap-3 bg-slate-800/30 border border-white/5 rounded-lg px-3 py-2.5">
                <Clock className="w-4 h-4 text-violet-400 shrink-0" />
                <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold shrink-0">Interval</label>
                <span className="text-[10px] text-slate-500 shrink-0">5s</span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 shrink-0">60s</span>
                <span className={`text-sm font-bold min-w-[40px] text-center px-2 py-1 rounded-md ${isListening
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-slate-700/50 text-slate-300"
                  }`}>{intervalSeconds}s</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Compact Action Bar ─────────────────────────────── */}
      <div className="border-b border-white/5 bg-[#0d0d24]/40">
        <div className="max-w-[1800px] mx-auto px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2">
          {/* Start/Stop — always prominent */}
          {!isListening ? (
            <Button
              onClick={startListening}
              className={`${sttEngine === "groq"
                ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                : "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500"
                } text-white px-4 sm:px-6 py-3 sm:py-5 rounded-xl font-semibold shadow-lg transition-all active:scale-95`}
            >
              <Mic className="mr-1.5 w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Start {sttEngine === "groq" ? "(Groq)" : "(Browser)"}</span>
            </Button>
          ) : (
            <Button
              onClick={stopListening}
              className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-4 sm:px-6 py-3 sm:py-5 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
            >
              <MicOff className="mr-1.5 w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Stop</span>
            </Button>
          )}

          {/* Flash Translate */}
          <Button
            onClick={flashTranslate}
            disabled={!pendingText.trim() && !isListening}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black px-3 sm:px-5 py-3 sm:py-5 rounded-xl font-semibold shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Zap className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Flash Translate</span>
          </Button>

          {/* API Status Mini (mobile) */}
          {isListening && sttEngine === "groq" && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${apiStatus.groq === "recording" ? "bg-red-500/15 text-red-400"
              : apiStatus.groq === "sending" ? "bg-orange-500/15 text-orange-400"
                : apiStatus.groq === "processing" ? "bg-amber-500/15 text-amber-400 animate-pulse"
                  : "bg-slate-800/50 text-slate-500"
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${apiStatus.groq === "recording" ? "bg-red-400 animate-pulse"
                : apiStatus.groq === "sending" ? "bg-orange-400"
                  : apiStatus.groq === "processing" ? "bg-amber-400 animate-pulse"
                    : "bg-slate-600"
                }`} />
              {apiStatus.groq === "recording" ? "🎙️" : apiStatus.groq === "sending" ? "📤" : apiStatus.groq === "processing" ? "🧠" : "⏸️"}
            </div>
          )}
          {isTranslating && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Translating</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Reset Subject */}
          <Button
            onClick={() => { clearScreen(); setTranscriptAtBottom(true); setTranslationAtBottom(true); }}
            className="bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white h-8 sm:h-auto px-3 sm:px-5 sm:py-5 rounded-lg sm:rounded-xl font-semibold transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">New Subject</span>
          </Button>
          <Button
            variant="outline"
            onClick={generateSummary}
            disabled={transcripts.length === 0 || isSummarizing}
            className="border-white/10 hover:bg-white/5 h-8 sm:h-auto px-2 sm:px-5 sm:py-5 rounded-lg sm:rounded-xl font-semibold disabled:opacity-40"
          >
            {isSummarizing ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin sm:mr-2" /> : <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />}
            <span className="hidden sm:inline">Summary</span>
          </Button>
          <Button
            variant="outline"
            onClick={downloadTranscript}
            disabled={transcripts.length === 0}
            className="border-white/10 hover:bg-white/5 h-8 sm:h-auto px-2 sm:px-5 sm:py-5 rounded-lg sm:rounded-xl font-semibold disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      {/* ─── Mobile Tab Switcher ───────────────────────────── */}
      <div className="lg:hidden border-b border-white/5 bg-[#0d0d24]/30">
        <div className="flex">
          <button
            onClick={() => setMobileView("translation")}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-center transition-all ${mobileView === "translation"
              ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5"
              : "text-slate-500"
              }`}
          >
            🌐 Translation ({translations.length})
          </button>
          <button
            onClick={() => setMobileView("transcription")}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-center transition-all ${mobileView === "transcription"
              ? "text-blue-400 border-b-2 border-blue-400 bg-blue-500/5"
              : "text-slate-500"
              }`}
          >
            🎙️ Original ({transcripts.length})
          </button>
        </div>
      </div>

      {/* ─── Main Panels ────────────────────────────────── */}
      <div className="flex-1 max-w-[1800px] mx-auto w-full p-2 sm:p-4 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4 h-[calc(100dvh-180px)] sm:h-[calc(100vh-220px)]">

          {/* TRANSLATION Panel — PRIMARY on mobile (shown first) */}
          <Card className={`bg-[#0e0e28]/60 border-white/5 backdrop-blur-sm flex flex-col overflow-hidden order-1 lg:order-2 ${mobileView !== "translation" ? "hidden lg:flex" : "flex"
            }`}>
            <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">
                  Translation
                </h2>
                {isTranslating && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
              </div>
              <span className="text-xs text-slate-500">{translations.length}</span>
            </div>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <div ref={translationScrollRef} onScroll={onTranslationScroll} className="h-full overflow-y-auto px-4 py-3 sm:p-5 scroll-smooth">
                {translations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 min-h-[150px]">
                    <Languages className={`w-8 h-8 opacity-20 ${isTranslating ? "animate-pulse" : ""}`} />
                    <p className="text-sm text-center">
                      {isTranslating ? "Translating..." : isListening ? "Waiting for speech..." : "Press Start to begin"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {translations.map((t) => (
                      <div key={t.id} className="group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">
                            {formatTime(t.timestamp)}
                          </span>
                        </div>
                        <p className="text-emerald-50 leading-relaxed text-base sm:text-[17px] font-medium">
                          {t.text}
                        </p>
                      </div>
                    ))}
                    <div ref={translationEndRef} />
                  </div>
                )}
              </div>
              {/* Scroll to live button */}
              {!translationAtBottom && translations.length > 0 && (
                <button
                  onClick={() => { translationEndRef.current?.scrollIntoView({ behavior: "smooth" }); setTranslationAtBottom(true); }}
                  className="absolute bottom-3 right-3 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg flex items-center gap-1 transition-all animate-bounce"
                >
                  <ArrowDown className="w-3 h-3" /> Live
                </button>
              )}
            </CardContent>
          </Card>

          {/* TRANSCRIPTION Panel — Secondary on mobile */}
          <Card className={`bg-[#0e0e28]/60 border-white/5 backdrop-blur-sm flex flex-col overflow-hidden order-2 lg:order-1 ${mobileView !== "transcription" ? "hidden lg:flex" : "flex"
            }`}>
            <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <h2 className="text-sm font-semibold text-blue-300 uppercase tracking-wider">
                  Transcription
                </h2>
              </div>
              <span className="text-xs text-slate-500">{transcripts.length}</span>
            </div>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <div ref={transcriptScrollRef} onScroll={onTranscriptScroll} className="h-full overflow-y-auto px-4 py-3 sm:p-5 scroll-smooth">
                {transcripts.length === 0 && !pendingText ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3 min-h-[150px]">
                    <Mic className={`w-8 h-8 opacity-20 ${isListening ? "animate-pulse" : ""}`} />
                    <p className="text-sm text-center">
                      {isListening ? "Listening... speak now" : "Press Start to begin"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {transcripts.map((t) => (
                      <div key={t.id} className="group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded">
                            {formatTime(t.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-200 leading-relaxed text-sm sm:text-[15px]">
                          {t.text}
                        </p>
                      </div>
                    ))}

                    {/* Pending / interim text */}
                    {pendingText && (
                      <div className="opacity-50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded animate-pulse">
                            live
                          </span>
                        </div>
                        <p className="text-slate-400 leading-relaxed text-sm italic">
                          {pendingText}
                        </p>
                      </div>
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                )}
              </div>
              {/* Scroll to live button */}
              {!transcriptAtBottom && transcripts.length > 0 && (
                <button
                  onClick={() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); setTranscriptAtBottom(true); }}
                  className="absolute bottom-3 right-3 bg-blue-600/90 hover:bg-blue-500 text-white rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg flex items-center gap-1 transition-all animate-bounce"
                >
                  <ArrowDown className="w-3 h-3" /> Live
                </button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Summary Modal ──────────────────────────────── */}
      {showSummary && summary && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
          <Card className="bg-[#12122e] border-white/10 w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col shadow-2xl shadow-violet-500/10 rounded-t-2xl sm:rounded-2xl">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                Summary
              </h3>
              <Button
                variant="ghost" size="sm"
                onClick={() => { setShowSummary(false); clearSummary(); }}
                className="text-slate-400 hover:text-white h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardContent className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                {summary.split("\n").map((line, i) => {
                  if (line.startsWith("## ")) {
                    return <h3 key={i} className="text-violet-300 text-sm sm:text-base font-bold mt-4 mb-2">{line.replace("## ", "")}</h3>;
                  }
                  if (line.startsWith("- ")) {
                    return (
                      <div key={i} className="flex items-start gap-2 ml-2 mb-1">
                        <span className="text-violet-400 mt-1">•</span>
                        <span className="text-slate-300 text-sm">{line.replace("- ", "")}</span>
                      </div>
                    );
                  }
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-slate-300 text-sm mb-1">{line}</p>;
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Footer (hidden on mobile when listening for more space) ───── */}
      <footer className={`border-t border-white/5 bg-[#0d0d24]/60 py-1.5 sm:py-2 text-center ${isListening ? "hidden sm:block" : ""}`}>
        <p className="text-[10px] sm:text-[11px] text-slate-600">
          {sttEngine === "groq" ? "Groq Whisper" : "Web Speech API"} + Gemini 2.5 Flash
        </p>
      </footer>
    </div>
  );
}
