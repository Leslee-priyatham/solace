"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The clinician is the "host" and always makes the offer; the client is the "guest".
export type Role = "host" | "guest";
export type CallState = "idle" | "waiting" | "connecting" | "connected" | "ended" | "error";

const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

type Signal = { peer: string; kind: string; payload: unknown; at: number };

export function useCall(room: string, role: Role) {
  const [state, setState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteName, setRemoteName] = useState<string | null>(null);

  const peerId = useRef(`${role}-${Math.random().toString(36).slice(2, 10)}`);
  const pc = useRef<RTCPeerConnection | null>(null);
  const remotePeer = useRef<string | null>(null);
  const since = useRef(Date.now() - 2000);
  const poller = useRef<number | null>(null);
  const local = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const signal = useCallback(
    (kind: string, payload: unknown, target: string | null = null) =>
      fetch(`/api/public/telehealth/${room}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peer: peerId.current, target, kind, payload }) }),
    [room],
  );

  const resetPeer = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    remotePeer.current = null;
    pendingIce.current = [];
    setRemoteStream(null);
  }, []);

  const makePeer = useCallback(
    (target: string) => {
      resetPeer();
      remotePeer.current = target;
      const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      local.current?.getTracks().forEach((t) => conn.addTrack(t, local.current!));
      const remote = new MediaStream();
      conn.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      conn.onicecandidate = (e) => e.candidate && signal("ice", e.candidate.toJSON(), target);
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === "connected") setState("connected");
        if (["failed", "disconnected"].includes(conn.connectionState)) setState("waiting");
      };
      pc.current = conn;
      return conn;
    },
    [resetPeer, signal],
  );

  const handle = useCallback(
    async (s: Signal) => {
      if (s.kind === "join") {
        const joinName = (s.payload as { name?: string } | null)?.name;
        if (joinName) setRemoteName(joinName);
        if (role === "host") {
          setState("connecting");
          const conn = makePeer(s.peer);
          const offer = await conn.createOffer();
          await conn.setLocalDescription(offer);
          await signal("offer", offer, s.peer);
        } else {
          // Host arrived after us: announce ourselves to them directly.
          await signal("join", null, s.peer);
        }
      } else if (s.kind === "offer" && role === "guest") {
        setState("connecting");
        const conn = makePeer(s.peer);
        await conn.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        for (const c of pendingIce.current.splice(0)) await conn.addIceCandidate(c).catch(() => {});
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        await signal("answer", answer, s.peer);
      } else if (s.kind === "answer" && role === "host" && pc.current && s.peer === remotePeer.current) {
        await pc.current.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        for (const c of pendingIce.current.splice(0)) await pc.current.addIceCandidate(c).catch(() => {});
      } else if (s.kind === "ice") {
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.payload as RTCIceCandidateInit).catch(() => {});
        else pendingIce.current.push(s.payload as RTCIceCandidateInit);
      } else if (s.kind === "leave" && s.peer === remotePeer.current) {
        resetPeer();
        setState("waiting");
      }
    },
    [makePeer, resetPeer, role, signal],
  );

  const start = useCallback(async (displayName?: string) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: { echoCancellation: true, noiseSuppression: true } });
      local.current = stream;
      setLocalStream(stream);
    } catch {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        local.current = stream;
        setLocalStream(stream);
        setCamOn(false);
      } catch {
        setError("Camera and microphone access is needed to join the call.");
        setState("error");
        return;
      }
    }
    setState("waiting");
    since.current = Date.now() - 2000;
    await signal("join", displayName ? { name: displayName } : null);
    poller.current = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/public/telehealth/${room}?peer=${peerId.current}&since=${since.current}`);
        if (!r.ok) return;
        const signals = (await r.json()) as Signal[];
        for (const s of signals) {
          since.current = Math.max(since.current, s.at);
          await handle(s);
        }
      } catch {
        // transient network error: keep polling
      }
    }, 1000);
  }, [handle, room, signal]);

  const end = useCallback(async () => {
    if (poller.current) clearInterval(poller.current);
    poller.current = null;
    await signal("leave", null).catch(() => {});
    resetPeer();
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    setLocalStream(null);
    setState("ended");
  }, [resetPeer, signal]);

  useEffect(() => {
    const leave = () => navigator.sendBeacon?.(`/api/public/telehealth/${room}`, new Blob([JSON.stringify({ peer: peerId.current, kind: "leave" })], { type: "application/json" }));
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      if (poller.current) clearInterval(poller.current);
      local.current?.getTracks().forEach((t) => t.stop());
      pc.current?.close();
    };
  }, [room]);

  const toggleMic = () => {
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((m) => !m);
  };
  const toggleCam = () => {
    local.current?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((c) => !c);
  };
  const toggleShare = async () => {
    const sender = pc.current?.getSenders().find((s) => s.track?.kind === "video");
    if (sharing) {
      const cam = local.current?.getVideoTracks()[0];
      if (sender && cam) await sender.replaceTrack(cam);
      setSharing(false);
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      if (sender) await sender.replaceTrack(track);
      track.onended = async () => {
        const cam = local.current?.getVideoTracks()[0];
        if (sender && cam) await sender.replaceTrack(cam);
        setSharing(false);
      };
      setSharing(true);
    } catch {
      // user cancelled
    }
  };

  return { state, error, remoteName, localStream, remoteStream, micOn, camOn, sharing, start, end, toggleMic, toggleCam, toggleShare };
}
