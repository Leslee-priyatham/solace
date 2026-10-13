import "server-only";
import { db } from "@/lib/db";

/** Options for the client and template pickers on capture screens. */
export async function captureOptions(appointmentId?: string) {
  const [clients, templates, appointment] = await Promise.all([
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT"] } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, kind: true } }),
    db.noteTemplate.findMany({ where: { archived: false, category: { not: "CLIENT_NOTE" } }, orderBy: [{ isSystem: "asc" }, { name: "asc" }], select: { id: true, name: true, isSystem: true } }),
    appointmentId ? db.appointment.findUnique({ where: { id: appointmentId }, include: { client: true } }) : null,
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, kind: c.kind })),
    templates: templates.map((t) => ({ id: t.id, name: t.isSystem ? t.name : `${t.name} (custom)` })),
    appointment: appointment ? { id: appointment.id, clientId: appointment.clientId, label: `${appointment.client?.firstName ?? ""} ${appointment.client?.lastName ?? ""}`.trim() } : null,
  };
}
