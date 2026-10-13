import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Minimal WebRTC signalling relay over HTTP polling. Rooms are a clinician's telehealth slug.
const KINDS = new Set(["join", "offer", "answer", "ice", "leave"]);

async function roomExists(room: string) {
  return !!(await db.user.findUnique({ where: { telehealthSlug: room }, select: { id: true } }));
}

export async function POST(req: Request, { params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!(await roomExists(room))) return NextResponse.json({ error: "Unknown room" }, { status: 404 });
  const body = (await req.json()) as { peer?: string; target?: string | null; kind?: string; payload?: unknown };
  if (!body.peer || !body.kind || !KINDS.has(body.kind)) return NextResponse.json({ error: "Bad signal" }, { status: 400 });
  const payload = JSON.stringify(body.payload ?? null);
  if (payload.length > 200_000) return NextResponse.json({ error: "Signal too large" }, { status: 413 });
  await db.telehealthSignal.create({ data: { room, peer: body.peer.slice(0, 64), target: body.target?.slice(0, 64) ?? null, kind: body.kind, payload } });
  // Housekeeping: drop signals older than an hour.
  await db.telehealthSignal.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3600e3) } } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request, { params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  const url = new URL(req.url);
  const peer = url.searchParams.get("peer");
  const since = Number(url.searchParams.get("since") ?? 0);
  if (!peer) return NextResponse.json({ error: "peer required" }, { status: 400 });
  const signals = await db.telehealthSignal.findMany({
    where: { room, peer: { not: peer }, createdAt: { gt: new Date(since) }, OR: [{ target: null }, { target: peer }] },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json(signals.map((s) => ({ peer: s.peer, kind: s.kind, payload: JSON.parse(s.payload), at: s.createdAt.getTime() })));
}
