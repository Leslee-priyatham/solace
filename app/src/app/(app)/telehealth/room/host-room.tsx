"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, Copy, Loader2, Video } from "lucide-react";
import { Button, Card, Checkbox, Field, Notice, Select, cn } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { useCall } from "@/components/telehealth/use-call";
import { VideoStage } from "@/components/telehealth/video-stage";
import { clock } from "@/lib/format";
import { uploadSession } from "@/app/(app)/capture/session-setup";

export function HostRoom({
  room,
  joinLink,
  appointmentId,
  client,
  clients,
  canTranscribe,
}: {
  room: string;
  joinLink: string;
  appointmentId?: string;
  client: { id: string; name: string } | null;
  clients: { id: string; name: string }[];
  canTranscribe: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const call = useCall(room, "host");
  const [clientId, setClientId] = useState(client?.id ?? "");
  const [record, setRecord] = useState(canTranscribe);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const startedAt = useRef<Date | null>(null);

  // Start recording (both voices mixed) as soon as the client connects.
  useEffect(() => {
    if (call.state !== "connected" || !record || recording || !call.localStream || !call.remoteStream) return;
    const ac = new AudioContext();
    ctx.current = ac;
    const dest = ac.createMediaStreamDestination();
    for (const s of [call.localStream, call.remoteStream]) {
      if (s.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest);
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.start(1000);
    recorder.current = rec;
    startedAt.current = new Date();
    setRecording(true);
  }, [call.state, call.localStream, call.remoteStream, record, recording]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const finish = async () => {
    const rec = recorder.current;
    await call.end();
    if (!rec) {
      router.push("/telehealth");
      return;
    }
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    ctx.current?.close().catch(() => {});
    const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
    if (blob.size < 2000) {
      router.push("/telehealth");
      return;
    }
    const form = new FormData();
    form.append("audio", blob, `telehealth.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    form.append("mode", "TELEHEALTH");
    form.append("durationSec", String(elapsed));
    if (startedAt.current) form.append("startedAt", startedAt.current.toISOString());
    if (clientId) form.append("clientId", clientId);
    if (appointmentId) form.append("appointmentId", appointmentId);
    try {
      setUploading(0);
      const id = await uploadSession(form, setUploading);
      router.push(`/sessions/${id}`);
    } catch (e) {
      setUploading(null);
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  };

  if (uploading !== null) {
    return (
      <Card className="mx-auto mt-20 max-w-md p-8 text-center">
        <Loader2 className="mx-auto size-8 animate-spin text-brand-600" />
        <p className="mt-3 font-medium">Saving the session recording… {uploading}%</p>
        <p className="text-sm text-muted">Your note will be written next.</p>
      </Card>
    );
  }

  if (call.state === "idle" || call.state === "error") {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-6">
        <h1 className="text-2xl font-semibold">Start a telehealth session</h1>
        {call.error && <Notice tone="error">{call.error}</Notice>}
        <Card className="space-y-4 p-6">
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!!appointmentId}>
              <option value="">Not linked to a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            label={canTranscribe ? "Record the session and write a note afterwards (needs client consent)" : "Recording needs a transcription provider (Settings → AI providers)"}
            checked={record}
            disabled={!canTranscribe}
            onChange={(e) => setRecord(e.target.checked)}
          />
          <div className="rounded-lg bg-canvas p-3 text-sm">
            <div className="mb-1 font-medium">Client join link</div>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-muted">{joinLink}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(joinLink);
                  toast("Join link copied");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <Button size="lg" className="w-full" onClick={() => call.start()}>
            <Video className="size-5" /> Open my room
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{clients.find((c) => c.id === clientId)?.name ?? "Telehealth session"}</h1>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(joinLink);
            toast("Join link copied");
          }}
        >
          <Copy className="size-4" /> Copy join link
        </Button>
      </div>
      <VideoStage
        state={call.state}
        local={call.localStream}
        remote={call.remoteStream}
        remoteName={call.remoteName ?? "your client"}
        waitingText="Waiting for your client to join…"
        micOn={call.micOn}
        camOn={call.camOn}
        sharing={call.sharing}
        onMic={call.toggleMic}
        onCam={call.toggleCam}
        onShare={call.toggleShare}
        onEnd={() => (recording ? confirm("End the session and create the note?") && finish() : finish())}
        topRight={
          recording ? (
            <span className={cn("flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-sm text-white")}>
              <Circle className="size-3 animate-pulse fill-red-500 text-red-500" /> Recording {clock(elapsed)}
            </span>
          ) : null
        }
      />
    </div>
  );
}
