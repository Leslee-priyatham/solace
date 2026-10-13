"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { SessionSetup, uploadSession, type CaptureOptions } from "../session-setup";

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
}

export function WriteForm({ options, initialClientId }: { options: CaptureOptions; initialClientId?: string }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(options.appointment?.clientId ?? initialClientId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [minutes, setMinutes] = useState("50");
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRec | null>(null);

  function toggleDictation() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) {
      setError("Live dictation isn't supported in this browser. Use Chrome or Edge, or record and upload audio instead.");
      return;
    }
    const r = new Rec();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setText((t) => `${t}${t && !t.endsWith(" ") && !t.endsWith("\n") ? " " : ""}${finalText.trim()}`);
      setInterim(interimText);
    };
    r.onerror = (e) => e.error !== "no-speech" && setError(`Dictation stopped: ${e.error}`);
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    r.start();
    rec.current = r;
    setListening(true);
    setError(null);
  }

  async function submit() {
    if (!text.trim()) return;
    rec.current?.stop();
    setBusy(true);
    const form = new FormData();
    form.append("mode", "DICTATION");
    form.append("text", text);
    form.append("durationSec", String(Math.round(Number(minutes) * 60) || 0));
    form.append("startedAt", new Date(when).toISOString());
    if (clientId) form.append("clientId", clientId);
    if (templateId) form.append("templateId", templateId);
    if (options.appointment) form.append("appointmentId", options.appointment.id);
    try {
      const id = await uploadSession(form, () => {});
      router.push(`/sessions/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="p-5">
        {error && (
          <Notice tone="error" className="mb-4">
            {error}
          </Notice>
        )}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Session summary</span>
          <Button size="sm" variant={listening ? "danger" : "outline"} onClick={toggleDictation}>
            {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            {listening ? "Stop dictating" : "Dictate"}
          </Button>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          placeholder={"e.g.\n- Client reports sleep improved, mood 6/10\n- Discussed conflict with sister; practised I-statements\n- Denies SI\n- Homework: thought record x3, next session in 1 week"}
        />
        {interim && <p className="mt-2 text-sm italic text-muted">{interim}…</p>}
        <div className="mt-2 text-xs text-muted">{text.trim() ? `${text.trim().split(/\s+/).length} words` : "Tip: include presentation, topics, interventions, risk, and plan."}</div>
      </Card>
      <Card className="h-fit space-y-4 p-5">
        <h3 className="font-semibold">Session details</h3>
        <SessionSetup options={options} clientId={clientId} setClientId={setClientId} templateId={templateId} setTemplateId={setTemplateId} disabled={busy} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date & time">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="Minutes">
            <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        </div>
        <Button className="w-full" onClick={submit} disabled={!text.trim() || busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Generate note
        </Button>
      </Card>
    </div>
  );
}
