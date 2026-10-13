import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/ai/client";
import { HostRoom } from "./host-room";

export const metadata = { title: "Telehealth session" };

export default async function RoomPage({ searchParams }: { searchParams: Promise<{ appointment?: string; client?: string }> }) {
  const user = await requireUser();
  const { appointment, client } = await searchParams;
  const appt = appointment ? await db.appointment.findUnique({ where: { id: appointment }, include: { client: true } }) : null;
  const clientRow = appt?.client ?? (client ? await db.client.findUnique({ where: { id: client } }) : null);
  const clients = await db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT"] } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <HostRoom
      room={user.telehealthSlug}
      joinLink={`${origin}/join/${user.telehealthSlug}${appt ? `?a=${appt.id}` : ""}`}
      appointmentId={appt?.id}
      client={clientRow ? { id: clientRow.id, name: `${clientRow.firstName} ${clientRow.lastName}` } : null}
      clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      canTranscribe={await isConfigured("transcription")}
    />
  );
}
