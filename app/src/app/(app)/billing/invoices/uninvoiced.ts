"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** Sessions for a client that aren't on any invoice yet. */
export async function uninvoicedSessions(clientId: string) {
  await requireUser();
  const sessions = await db.session.findMany({
    where: { clientId, invoiceItems: { none: {} }, billingType: { not: "NONE" } },
    include: { appointment: { include: { service: true } } },
    orderBy: { startedAt: "asc" },
  });
  return sessions.map((s) => ({
    id: s.id,
    date: s.startedAt.toISOString(),
    title: s.title,
    cpt: s.cpt,
    description: s.appointment?.service?.name ?? "Psychotherapy session",
    feeCents: s.feeCents ?? s.appointment?.service?.rateCents ?? 0,
    billingType: s.billingType,
  }));
}
