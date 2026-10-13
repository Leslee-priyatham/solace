import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, audit } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { processSession } from "@/lib/sessions";

export const maxDuration = 300;

/**
 * Creates a session from a recording, an uploaded file, or written/dictated text,
 * then starts transcription + note generation in the background.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const form = await req.formData();
  const mode = String(form.get("mode") ?? "IN_PERSON");
  const clientId = (form.get("clientId") as string) || null;
  const appointmentId = (form.get("appointmentId") as string) || null;
  const templateId = (form.get("templateId") as string) || undefined;
  const text = (form.get("text") as string) || null;
  const title = (form.get("title") as string) || null;
  const durationSec = Number(form.get("durationSec") ?? 0) || 0;
  const startedAtRaw = form.get("startedAt") as string | null;
  const audio = form.get("audio");

  if (!(audio instanceof File) && !text?.trim()) {
    return NextResponse.json({ error: "Add a recording or some text to create a note from." }, { status: 400 });
  }
  if (appointmentId) {
    const taken = await db.session.findUnique({ where: { appointmentId } });
    if (taken) return NextResponse.json({ error: "This appointment already has a session." }, { status: 409 });
  }

  let audioPath: string | null = null;
  if (audio instanceof File && audio.size > 0) {
    audioPath = await saveUpload("sessions", audio.name || "recording.webm", Buffer.from(await audio.arrayBuffer()));
  }
  const appointment = appointmentId ? await db.appointment.findUnique({ where: { id: appointmentId }, include: { service: true } }) : null;
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : appointment?.startsAt ?? new Date(Date.now() - durationSec * 1000);

  const session = await db.session.create({
    data: {
      clientId: clientId ?? appointment?.clientId ?? null,
      providerId: user.id,
      appointmentId,
      title,
      captureMode: mode,
      status: audioPath ? "TRANSCRIBING" : "GENERATING",
      startedAt,
      endedAt: durationSec ? new Date(startedAt.getTime() + durationSec * 1000) : null,
      durationSec,
      audioPath,
      rawText: text,
      cpt: appointment?.service?.cpt ?? null,
      feeCents: appointment?.feeCents ?? appointment?.service?.rateCents ?? null,
    },
  });
  if (appointment) await db.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
  await audit(user.id, "create", "Session", session.id, mode);

  // Fire and forget: the session page polls status while this runs.
  void processSession(session.id, { templateId });
  return NextResponse.json({ id: session.id });
}
