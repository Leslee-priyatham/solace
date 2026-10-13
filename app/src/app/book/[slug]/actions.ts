"use server";

import { db } from "@/lib/db";
import { token } from "@/lib/crypto";
import { openSlots } from "@/lib/availability";
import { nextMrn } from "@/lib/bootstrap";

async function bookablePractice(slug: string) {
  const p = await db.practice.findUnique({ where: { slug } });
  const s = ((p?.settings ?? {}) as { portal?: { selfScheduling?: boolean; autoConfirm?: boolean } }).portal ?? {};
  if (!p || !s.selfScheduling) throw new Error("Online booking isn't available for this practice.");
  return { practice: p, autoConfirm: !!s.autoConfirm };
}

/** Public: open slots for a service/provider over the next few weeks. */
export async function getSlots(slug: string, serviceId: string, providerId: string, fromIso: string) {
  await bookablePractice(slug);
  const service = await db.service.findFirst({ where: { id: serviceId, selfSchedule: true, archived: false } });
  if (!service) return [];
  return openSlots(providerId, service.durationMin, new Date(fromIso), 7);
}

export async function bookSlot(
  slug: string,
  data: { serviceId: string; providerId: string; start: string; firstName: string; lastName: string; email: string; phone?: string; note?: string; portalToken?: string },
): Promise<{ error?: string; ok?: boolean; confirmed?: boolean }> {
  try {
    const { autoConfirm } = await bookablePractice(slug);
    const service = await db.service.findFirst({ where: { id: data.serviceId, selfSchedule: true, archived: false } });
    if (!service) return { error: "That service can't be booked online." };
    const start = new Date(data.start);
    const free = await openSlots(data.providerId, service.durationMin, new Date(start.getTime() - 60000), 1);
    if (!free.some((s) => s.start === start.toISOString())) return { error: "That time was just taken. Please choose another slot." };

    let client = data.portalToken ? await db.client.findUnique({ where: { portalToken: data.portalToken } }) : null;
    if (!client) {
      if (!data.firstName.trim() || !data.lastName.trim() || !/^\S+@\S+\.\S+$/.test(data.email)) return { error: "Please enter your name and a valid email." };
      client =
        (await db.client.findFirst({ where: { email: data.email.trim().toLowerCase() } })) ??
        (await db.client.create({
          data: {
            mrn: await nextMrn(),
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phone || null,
            status: "PROSPECT",
            portalToken: token(),
            providerId: data.providerId,
            defaultServiceId: service.id,
          },
        }));
    }
    const appt = await db.appointment.create({
      data: {
        kind: "SESSION",
        clientId: client.id,
        providerId: data.providerId,
        serviceId: service.id,
        title: service.name,
        modality: "TELEHEALTH",
        startsAt: start,
        endsAt: new Date(start.getTime() + service.durationMin * 60000),
        status: autoConfirm ? "SCHEDULED" : "REQUESTED",
        bookedOnline: true,
        feeCents: service.rateCents,
        notes: data.note || null,
      },
    });
    let conv = await db.conversation.findFirst({ where: { clientId: client.id, archived: false } });
    if (!conv) conv = await db.conversation.create({ data: { clientId: client.id } });
    await db.message.create({
      data: {
        conversationId: conv.id,
        sender: "CLIENT",
        authorName: `${client.firstName} ${client.lastName}`,
        body: `Booked online: ${service.name} on ${appt.startsAt.toLocaleString()}.${data.note ? `\n\nNote: ${data.note}` : ""}`,
      },
    });
    await db.conversation.update({ where: { id: conv.id }, data: { providerUnread: { increment: 1 }, lastMessageAt: new Date() } });
    return { ok: true, confirmed: autoConfirm };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Booking failed" };
  }
}
