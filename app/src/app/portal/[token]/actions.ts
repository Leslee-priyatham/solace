"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/storage";

type R = { error?: string; ok?: boolean };

async function clientFor(token: string) {
  const c = await db.client.findUnique({ where: { portalToken: token } });
  if (!c || c.status === "DISCHARGED") throw new Error("This portal link is no longer active.");
  return c;
}

/** Public: a client replying from their portal. */
export async function sendClientMessage(token: string, form: FormData): Promise<R> {
  try {
    const c = await clientFor(token);
    const body = String(form.get("body") ?? "").trim().slice(0, 5000);
    const file = form.get("file");
    const hasFile = file instanceof File && file.size > 0;
    if (!body && !hasFile) return { error: "Write a message first." };
    if (hasFile && (file as File).size > 20 * 1024 * 1024) return { error: "Attachments can be up to 20 MB." };
    const blocked = ((await db.setting.findUnique({ where: { key: "messaging.blocked" } }))?.value ?? []) as string[];
    if (blocked.includes(c.id)) return { error: "Messaging isn't available. Please contact the practice directly." };
    let conv = await db.conversation.findFirst({ where: { clientId: c.id, archived: false } });
    if (!conv) conv = await db.conversation.create({ data: { clientId: c.id } });
    const attachmentPath = hasFile ? await saveUpload(`messages/${conv.id}`, (file as File).name, Buffer.from(await (file as File).arrayBuffer())) : null;
    await db.message.create({
      data: { conversationId: conv.id, sender: "CLIENT", authorName: `${c.firstName} ${c.lastName}`, body, attachmentName: hasFile ? (file as File).name : null, attachmentPath },
    });
    await db.conversation.update({ where: { id: conv.id }, data: { providerUnread: { increment: 1 }, clientUnread: 0, lastMessageAt: new Date(), archived: false } });
    revalidatePath(`/portal/${token}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't send" };
  }
}

export async function markPortalRead(token: string): Promise<R> {
  const c = await db.client.findUnique({ where: { portalToken: token } });
  if (!c) return { error: "Not found" };
  await db.conversation.updateMany({ where: { clientId: c.id }, data: { clientUnread: 0 } });
  return { ok: true };
}

/** Public: client cancels an upcoming appointment (late cancellations are flagged for the clinician). */
export async function cancelAppointment(token: string, appointmentId: string, reason: string): Promise<R> {
  try {
    const c = await clientFor(token);
    const a = await db.appointment.findFirst({ where: { id: appointmentId, clientId: c.id } });
    if (!a || a.startsAt < new Date()) return { error: "This appointment can't be cancelled online." };
    const late = a.startsAt.getTime() - Date.now() < 24 * 3600e3;
    await db.appointment.update({ where: { id: a.id }, data: { status: late ? "LATE_CANCEL" : "CANCELLED" } });
    let conv = await db.conversation.findFirst({ where: { clientId: c.id, archived: false } });
    if (!conv) conv = await db.conversation.create({ data: { clientId: c.id } });
    await db.message.create({
      data: {
        conversationId: conv.id,
        sender: "CLIENT",
        authorName: `${c.firstName} ${c.lastName}`,
        body: `I've cancelled my appointment on ${a.startsAt.toLocaleString()}.${reason.trim() ? ` Reason: ${reason.trim()}` : ""}`,
      },
    });
    await db.conversation.update({ where: { id: conv.id }, data: { providerUnread: { increment: 1 }, lastMessageAt: new Date() } });
    revalidatePath(`/portal/${token}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't cancel" };
  }
}
