"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Pause, Play, Square, Monitor, Loader2, Trash2 } from "lucide-react";
import { Button, Card, Field, Notice, Select } from "@/components/ui";
import { clock } from "@/lib/format";
import { SessionSetup, uploadSession, type CaptureOptions } from "../session-setup";

type Phase = "idle" | "recording" | "paused" | "stopped" | "uploading";

export function Recorder({ mode, options, initialClientId }: { mode: "IN_PERSON" | "VIRTUAL"; options: CaptureOptions; initialClientId?: string }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(options.appointment?.clientId ?? initialClientId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streams = useRef<MediaStream[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);
  const startedAt = useRef<Date | null>(null);
  const timer = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setDevices(d.filter((x) => x.kind === "audioinput")))
      .catch(() => {});
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (phase !== "recording" && phase !== "paused" && !(phase === "stopped" && blob)) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase, blob]);

  function cleanup() {
    if (timer.current) clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streams.current = [];
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }

  async function start() {
    setError(null);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true },
      });
      streams.current.push(mic);
      // Labels become available once permission is granted.
      navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "audioinput")));

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const micSrc = ctx.createMediaStreamSource(mic);
      micSrc.connect(dest);
      micSrc.connect(analyser);

      if (mode === "VIRTUAL") {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streams.current.push(display);
        if (!display.getAudioTracks().length) {
          cleanup();
          setError("No audio was shared. Choose the tab with your call and tick “Share tab audio”, then try again.");
          return;
        }
        const tabSrc = ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks()));
        tabSrc.connect(dest);
        tabSrc.connect(analyser);
        display.getVideoTracks().forEach((t) => (t.onended = () => recorderRef.current?.state === "recording" && stop()));
      }

      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      rec.start(1000);
      recorderRef.current = rec;
      startedAt.current = new Date();
      setElapsed(0);
      setBlob(null);
      setPhase("recording");
      timer.current = window.setInterval(() => {
        if (recorderRef.current?.state === "recording") setElapsed((s) => s + 1);
      }, 1000);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(peak / 128);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      cleanup();
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone or screen permission was denied." : e instanceof Error ? e.message : "Could not start recording.");
    }
  }

  function pause() {
    recorderRef.current?.pause();
    setPhase("paused");
  }
  function resume() {
    recorderRef.current?.resume();
    setPhase("recording");
  }
  function stop() {
    recorderRef.current?.stop();
    cleanup();
    setLevel(0);
    setPhase("stopped");
  }
  function discard() {
    if (!confirm("Discard this recording? It can't be recovered.")) return;
    setBlob(null);
    setElapsed(0);
    setPhase("idle");
  }

  async function submit() {
    if (!blob) return;
    setPhase("uploading");
    setError(null);
    const form = new FormData();
    const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm";
    form.append("audio", blob, `session.${ext}`);
    form.append("mode", mode);
    form.append("durationSec", String(elapsed));
    if (startedAt.current) form.append("startedAt", startedAt.current.toISOString());
    if (clientId) form.append("clientId", clientId);
    if (templateId) form.append("templateId", templateId);
    if (options.appointment) form.append("appointmentId", options.appointment.id);
    try {
      const id = await uploadSession(form, setProgress);
      setBlob(null);
      router.push(`/sessions/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("stopped");
    }
  }

  const live = phase === "recording" || phase === "paused";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="flex flex-col items-center px-6 py-12">
        {error && (
          <Notice tone="error" className="mb-6 w-full">
            {error}
          </Notice>
        )}
        <div className="relative flex size-44 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-brand-200/60 transition-transform"
            style={{ transform: `scale(${phase === "recording" ? 0.7 + level * 1.2 : 0.7})` }}
          />
          <span className={`relative flex size-28 items-center justify-center rounded-full ${phase === "recording" ? "bg-red-500" : "bg-brand-600"} text-white shadow-lg`}>
            {mode === "VIRTUAL" ? <Monitor className="size-10" /> : <Mic className="size-10" />}
          </span>
        </div>
        <div className="mt-6 font-mono text-4xl tabular-nums">{clock(elapsed)}</div>
        <div className="mt-1 text-sm text-muted">
          {phase === "idle" && "Ready when you are"}
          {phase === "recording" && (
            <span className="flex items-center gap-1.5 text-red-600">
              <span className="size-2 animate-pulse rounded-full bg-red-600" /> Recording
            </span>
          )}
          {phase === "paused" && "Paused"}
          {phase === "stopped" && "Recording finished — review and create your note"}
          {phase === "uploading" && `Uploading… ${progress}%`}
        </div>

        <div className="mt-8 flex gap-3">
          {phase === "idle" && (
            <Button size="lg" onClick={start}>
              <Mic className="size-5" /> Start recording
            </Button>
          )}
          {phase === "recording" && (
            <Button size="lg" variant="outline" onClick={pause}>
              <Pause className="size-5" /> Pause
            </Button>
          )}
          {phase === "paused" && (
            <Button size="lg" variant="outline" onClick={resume}>
              <Play className="size-5" /> Resume
            </Button>
          )}
          {live && (
            <Button size="lg" variant="danger" onClick={stop}>
              <Square className="size-5" /> End session
            </Button>
          )}
          {phase === "stopped" && blob && (
            <>
              <Button size="lg" variant="outline" onClick={discard}>
                <Trash2 className="size-5" /> Discard
              </Button>
              <Button size="lg" onClick={submit}>
                Create note
              </Button>
            </>
          )}
          {phase === "uploading" && (
            <Button size="lg" disabled>
              <Loader2 className="size-5 animate-spin" /> Uploading
            </Button>
          )}
        </div>
        {phase === "stopped" && blob && <audio controls src={URL.createObjectURL(blob)} className="mt-6 w-full max-w-md" />}
      </Card>

      <Card className="h-fit space-y-4 p-5">
        <h3 className="font-semibold">Session details</h3>
        {options.appointment && <Notice tone="info">Linked to the appointment with {options.appointment.label}.</Notice>}
        <SessionSetup options={options} clientId={clientId} setClientId={setClientId} templateId={templateId} setTemplateId={setTemplateId} disabled={phase === "uploading"} />
        <Field label="Microphone">
          <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={live}>
            <option value="">System default</option>
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">
          Make sure your client has consented to recording. Audio is stored in this app's local uploads folder and sent only to your transcription provider.
        </p>
      </Card>
    </div>
  );
}
