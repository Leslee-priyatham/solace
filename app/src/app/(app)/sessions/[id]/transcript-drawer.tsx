"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Download, ArrowLeftRight, ChevronDown, Search } from "lucide-react";
import { clock } from "@/lib/format";
import { cn } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import type { LabeledUtterance } from "@/lib/ai/clinical";
import { swapSpeakers } from "./actions";

export function TranscriptDrawer({
  open,
  onClose,
  sessionId,
  transcript,
  chapters,
  audioUrl,
  clientName,
  providerName,
  durationSec,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  transcript: LabeledUtterance[];
  chapters: { title: string; start: number }[];
  audioUrl: string | null;
  clientName: string;
  providerName: string;
  durationSec: number;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [chapterOpen, setChapterOpen] = useState(false);
  const toast = useToast();
  const words = useMemo(() => transcript.reduce((n, u) => n + u.text.split(/\s+/).length, 0), [transcript]);
  const speakers = new Set(transcript.map((u) => u.speaker)).size;
  const name = (u: LabeledUtterance) => (u.speaker === "PROVIDER" ? "You" : u.speaker === "CLIENT" ? clientName : u.name ?? "Other");
  const asText = () => transcript.map((u) => `[${clock(u.start)}] ${u.speaker === "PROVIDER" ? providerName : name(u)}: ${u.text}`).join("\n");
  const currentChapter = [...chapters].reverse().find((c) => c.start <= now);

  useEffect(() => {
    if (!open) audio.current?.pause();
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  const seek = (t: number) => {
    if (audio.current) {
      audio.current.currentTime = t;
      audio.current.play().catch(() => {});
    }
    setNow(t);
  };
  const filtered = query ? transcript.filter((u) => u.text.toLowerCase().includes(query.toLowerCase())) : transcript;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold">Transcript</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-black/5" aria-label="Close transcript">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3 text-sm">
          <span className="text-muted">
            {clock(durationSec)} · {speakers} speaker{speakers === 1 ? "" : "s"} · {words.toLocaleString()} words
          </span>
          <div className="flex gap-1">
            <button
              title="Swap speaker labels"
              onClick={async () => {
                await swapSpeakers(sessionId);
                toast("Speakers swapped");
              }}
              className="rounded p-1.5 text-muted hover:bg-black/5"
            >
              <ArrowLeftRight className="size-4" />
            </button>
            <button
              title="Copy transcript"
              onClick={async () => {
                await navigator.clipboard.writeText(asText());
                toast("Transcript copied");
              }}
              className="rounded p-1.5 text-muted hover:bg-black/5"
            >
              <Copy className="size-4" />
            </button>
            <button
              title="Download as text"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([asText()], { type: "text/plain" }));
                a.download = "transcript.txt";
                a.click();
              }}
              className="rounded p-1.5 text-muted hover:bg-black/5"
            >
              <Download className="size-4" />
            </button>
          </div>
        </div>
        {audioUrl && (
          <div className="border-b border-line px-5 py-3">
            <audio ref={audio} src={audioUrl} controls className="w-full" onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
          </div>
        )}
        {chapters.length > 0 && (
          <div className="relative border-b border-line">
            <button onClick={() => setChapterOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3 text-left text-sm">
              <span className="truncate">
                {chapters.indexOf(currentChapter ?? chapters[0]) + 1}. {(currentChapter ?? chapters[0]).title}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted" />
            </button>
            {chapterOpen && (
              <div className="absolute left-0 right-0 top-full z-10 border-b border-line bg-white shadow-lg">
                {chapters.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      seek(c.start);
                      setChapterOpen(false);
                      document.getElementById(`utt-${transcript.findIndex((u) => u.start >= c.start)}`)?.scrollIntoView({ block: "start" });
                    }}
                    className="flex w-full gap-3 px-5 py-2 text-left text-sm hover:bg-canvas"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-muted">{clock(c.start)}</span>
                    {i + 1}. {c.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="border-b border-line px-5 py-2">
          <div className="flex items-center gap-2 rounded-lg bg-canvas px-3">
            <Search className="size-4 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript" className="h-9 flex-1 bg-transparent text-sm outline-none" />
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted">{transcript.length ? "No matches." : "No transcript for this session."}</p>}
          {filtered.map((u) => {
            const i = transcript.indexOf(u);
            const active = audioUrl && now >= u.start && now < u.end;
            return (
              <div key={i} id={`utt-${i}`} className={cn("rounded-lg px-2 py-1 transition-colors", active && "bg-brand-50")}>
                <button onClick={() => seek(u.start)} className="mb-0.5 flex items-center gap-2 text-xs">
                  <span className="font-mono text-muted">{clock(u.start)}</span>
                  <span className={cn("font-semibold", u.speaker === "PROVIDER" ? "text-brand-700" : "text-rose-600")}>{name(u)}</span>
                </button>
                <p className="text-[15px] leading-relaxed">{u.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
