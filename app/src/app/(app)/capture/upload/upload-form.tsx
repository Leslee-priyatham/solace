"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileAudio, Loader2 } from "lucide-react";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { SessionSetup, uploadSession, type CaptureOptions } from "../session-setup";

export function UploadForm({ options, initialClientId }: { options: CaptureOptions; initialClientId?: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState(options.appointment?.clientId ?? initialClientId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("audio/") && !f.type.startsWith("video/") && !/\.(mp3|m4a|wav|webm|ogg|flac|aac|mp4)$/i.test(f.name)) {
      setError("That doesn't look like an audio file.");
      return;
    }
    setError(null);
    setFile(f);
  };

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const duration = await new Promise<number>((resolve) => {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : 0);
      a.onerror = () => resolve(0);
      a.src = URL.createObjectURL(file);
    });
    const form = new FormData();
    form.append("audio", file, file.name);
    form.append("mode", "UPLOAD");
    form.append("durationSec", String(duration));
    form.append("startedAt", new Date(when).toISOString());
    if (clientId) form.append("clientId", clientId);
    if (templateId) form.append("templateId", templateId);
    if (options.appointment) form.append("appointmentId", options.appointment.id);
    try {
      const id = await uploadSession(form, setProgress);
      router.push(`/sessions/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-3xl space-y-5 p-6">
      {error && <Notice tone="error">{error}</Notice>}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas"}`}
      >
        {file ? <FileAudio className="mb-3 size-10 text-brand-600" /> : <UploadCloud className="mb-3 size-10 text-brand-600" />}
        <div className="font-medium">{file ? file.name : "Drop a recording here or click to browse"}</div>
        <div className="mt-1 text-sm text-muted">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "MP3, M4A, WAV, WebM, OGG, FLAC"}</div>
        <input type="file" accept="audio/*,video/mp4,video/webm" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      <SessionSetup options={options} clientId={clientId} setClientId={setClientId} templateId={templateId} setTemplateId={setTemplateId} disabled={busy} />
      <Field label="When was the session?" className="max-w-xs">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={busy} />
      </Field>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!file || busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? `Uploading ${progress}%` : "Create note"}
        </Button>
        {busy && <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>
    </Card>
  );
}
