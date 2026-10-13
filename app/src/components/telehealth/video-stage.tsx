"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "../ui";
import type { CallState } from "./use-call";

function VideoEl({ stream, muted, mirrored, className }: { stream: MediaStream | null; muted?: boolean; mirrored?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={cn("h-full w-full object-cover", mirrored && "-scale-x-100", className)} />;
}

export function VideoStage({
  state,
  local,
  remote,
  remoteName,
  waitingText,
  micOn,
  camOn,
  sharing,
  onMic,
  onCam,
  onShare,
  onEnd,
  extraControls,
  topRight,
}: {
  state: CallState;
  local: MediaStream | null;
  remote: MediaStream | null;
  remoteName: string;
  waitingText: string;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  onMic: () => void;
  onCam: () => void;
  onShare: () => void;
  onEnd: () => void;
  extraControls?: React.ReactNode;
  topRight?: React.ReactNode;
}) {
  const btn = "flex size-12 items-center justify-center rounded-full transition";
  return (
    <div className="relative h-[calc(100vh-180px)] min-h-[420px] overflow-hidden rounded-2xl bg-[#0b1513]">
      {remote && state === "connected" ? (
        <VideoEl stream={remote} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-white/80">
          {state === "connecting" ? <Loader2 className="mb-3 size-8 animate-spin" /> : <div className="mb-3 size-3 animate-pulse rounded-full bg-brand-400" />}
          <p>{state === "connecting" ? `Connecting to ${remoteName}…` : waitingText}</p>
        </div>
      )}
      <div className="absolute bottom-24 right-4 aspect-video w-48 overflow-hidden rounded-xl border border-white/20 bg-black shadow-xl sm:w-64">
        {camOn && local ? <VideoEl stream={local} muted mirrored={!sharing} /> : <div className="flex h-full items-center justify-center text-sm text-white/60">Camera off</div>}
      </div>
      {topRight && <div className="absolute right-4 top-4">{topRight}</div>}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent py-5">
        <button onClick={onMic} className={cn(btn, micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-500 text-white")} title={micOn ? "Mute" : "Unmute"}>
          {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        <button onClick={onCam} className={cn(btn, camOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-500 text-white")} title={camOn ? "Turn camera off" : "Turn camera on"}>
          {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </button>
        <button onClick={onShare} className={cn(btn, sharing ? "bg-brand-500 text-white" : "bg-white/15 text-white hover:bg-white/25")} title="Share screen">
          <MonitorUp className="size-5" />
        </button>
        {extraControls}
        <button onClick={onEnd} className={cn(btn, "w-16 bg-red-600 text-white hover:bg-red-700")} title="Leave call">
          <PhoneOff className="size-5" />
        </button>
      </div>
    </div>
  );
}
