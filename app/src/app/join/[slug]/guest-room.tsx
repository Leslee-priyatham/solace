"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Video, CheckCircle2 } from "lucide-react";
import { Button, Input, Notice } from "@/components/ui";
import { useCall } from "@/components/telehealth/use-call";
import { VideoStage } from "@/components/telehealth/video-stage";

export function GuestRoom({ room, providerName, practiceName, brandColor, clientName, portalHref }: { room: string; providerName: string; practiceName: string; brandColor: string; clientName: string; portalHref: string | null }) {
  const call = useCall(room, "guest");
  const [name, setName] = useState(clientName);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (call.state !== "idle") return;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        setPreview(s);
        if (previewRef.current) previewRef.current.srcObject = s;
      })
      .catch(() => {});
  }, [call.state]);

  useEffect(() => () => preview?.getTracks().forEach((t) => t.stop()), [preview]);

  return (
    <div className="min-h-screen bg-[#0f1c1a] px-4 py-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg text-sm font-semibold" style={{ background: brandColor }}>
            {practiceName[0] ?? "S"}
          </span>
          <span className="font-semibold">{practiceName}</span>
        </div>
        {call.state === "ended" ? (
          <div className="mx-auto mt-24 max-w-md rounded-2xl bg-white p-8 text-center text-ink">
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <h1 className="mt-3 text-xl font-semibold">You've left the session</h1>
            <p className="mt-1 text-muted">Thank you. You can close this window.</p>
            {portalHref && (
              <Link href={portalHref} className="mt-4 inline-block font-medium text-brand-700">
                Back to your portal →
              </Link>
            )}
          </div>
        ) : call.state === "idle" || call.state === "error" ? (
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <video ref={previewRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            </div>
            <div className="rounded-2xl bg-white p-6 text-ink">
              <h1 className="text-xl font-semibold">Session with {providerName}</h1>
              <p className="mt-1 text-sm text-muted">Check your camera and microphone, then join.</p>
              {call.error && (
                <Notice tone="error" className="mt-4">
                  {call.error}
                </Notice>
              )}
              <label className="mt-5 block text-sm font-medium">
                Your name
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
              </label>
              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={() => {
                  preview?.getTracks().forEach((t) => t.stop());
                  call.start(name.trim() || undefined);
                }}
              >
                <Video className="size-5" /> Join session
              </Button>
              <p className="mt-3 text-xs text-muted">Your video goes directly between you and your clinician's browser.</p>
            </div>
          </div>
        ) : (
          <VideoStage
            state={call.state}
            local={call.localStream}
            remote={call.remoteStream}
            remoteName={providerName}
            waitingText={`Waiting for ${providerName} to let you in…`}
            micOn={call.micOn}
            camOn={call.camOn}
            sharing={call.sharing}
            onMic={call.toggleMic}
            onCam={call.toggleCam}
            onShare={call.toggleShare}
            onEnd={call.end}
          />
        )}
      </div>
    </div>
  );
}
