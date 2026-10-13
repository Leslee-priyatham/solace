"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, FileText, Check, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { retryProcessing } from "./actions";

const STEPS = [
  { key: "TRANSCRIBING", label: "Transcribing and separating speakers", icon: AudioLines },
  { key: "GENERATING", label: "Writing your note", icon: FileText },
];

export function Processing({ sessionId, status, error, hasAudio }: { sessionId: string; status: string; error: string | null; hasAudio: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  useEffect(() => {
    if (current === "READY" || current === "ERROR") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/sessions/${sessionId}/status`);
      if (!r.ok) return;
      const s = (await r.json()) as { status: string };
      if (s.status !== current) {
        setCurrent(s.status);
        if (s.status === "READY" || s.status === "ERROR") router.refresh();
      }
    }, 2500);
    return () => clearInterval(t);
  }, [current, sessionId, router]);

  if (current === "ERROR") {
    const notConfigured = error?.includes("Settings → AI providers");
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-amber-500" />
        <h2 className="mt-3 text-lg font-semibold">We couldn't finish this note</h2>
        <p className="mt-2 break-words text-sm text-muted">{error}</p>
        <div className="mt-6 flex justify-center gap-2">
          {notConfigured && (
            <Link href="/settings/ai">
              <Button variant="outline">Set up AI providers</Button>
            </Link>
          )}
          <ActionButton variant="primary" size="md" action={() => retryProcessing(sessionId, false)} onDone={() => setCurrent(hasAudio ? "TRANSCRIBING" : "GENERATING")}>
            <RotateCcw className="size-4" /> Try again
          </ActionButton>
        </div>
      </Card>
    );
  }

  const steps = hasAudio ? STEPS : STEPS.slice(1);
  const activeIndex = steps.findIndex((s) => s.key === current);
  return (
    <Card className="mx-auto max-w-2xl p-8">
      <h2 className="text-center text-lg font-semibold">Your note is on its way</h2>
      <p className="mt-1 text-center text-sm text-muted">This usually takes under a minute. You can leave this page — we'll keep working.</p>
      <ol className="mt-8 space-y-4">
        {steps.map((s, i) => {
          const done = i < activeIndex || current === "READY";
          const active = i === activeIndex;
          return (
            <li key={s.key} className="flex items-center gap-4">
              <span className={`flex size-10 items-center justify-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                {done ? <Check className="size-5" /> : active ? <Loader2 className="size-5 animate-spin" /> : <s.icon className="size-5" />}
              </span>
              <span className={active ? "font-medium" : done ? "text-muted" : "text-slate-400"}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
