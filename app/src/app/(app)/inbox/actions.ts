"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";

type R = { error?: string; ok?: boolean; id?: string };

export async function sendMessage(form: FormData): Promise<R> {
  const user = await requireUser();
  const clientId = String(form.get("clientId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!clientId) return { error: "Choose a client." };
  if (!body && !hasFile) return { error: "Write a message or attach a file." };
  const blocked = ((await db.setting.findUnique({ where: { key: "messaging.blocked" } }))?.value ?? []) as string[];
  if (blocked.includes(clientId)) return { error: "Messaging is turned off for this client. Unblock them in Settings → Messaging." };

  let conv = await db.conversation.findFirst({ where: { clientId, archived: false } });
  if (!conv) conv = await db.conversation.create({ data: { clientId } });
  let attachmentPath: string | null = null;
  if (hasFile) attachmentPath = await saveUpload(`messages/${conv.id}`, (file as File).name, Buffer.from(await (file as File).arrayBuffer()));
  const prefs = (user.preferences ?? {}) as { messagingName?: string };
  await db.message.create({
    data: {
      conversationId: conv.id,
      sender: "PROVIDER",
      authorName: user.messagingName || prefs.messagingName || `${user.firstName} ${user.lastName}`,
      body,
      attachmentName: hasFile ? (file as File).name : null,
      attachmentPath,
    },
  });
  await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date(), providerUnread: 0 } });
  await audit(user.id, "send", "Message", conv.id);
  revalidatePath("/inbox");
  return { ok: true, id: conv.id };
}

export async function markRead(conversationId: string, unread = false): Promise<R> {
  await requireUser();
  await db.conversation.update({ where: { id: conversationId }, data: { providerUnread: unread ? 1 : 0 } });
  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setArchived(conversationId: string, archived: boolean): Promise<R> {
  await requireUser();
  await db.conversation.update({ where: { id: conversationId }, data: { archived } });
  revalidatePath("/inbox");
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<R> {
  await requireUser();
  const m = await db.message.findUniqueOrThrow({ where: { id } });
  if (m.sender !== "PROVIDER") return { error: "You can only delete your own messages." };
  await db.message.delete({ where: { id } });
  revalidatePath("/inbox");
  return { ok: true };
}

export async function sendAnnouncement(data: { subject: string; body: string; clientIds: string[] }): Promise<R> {
  const user = await requireUser();
  if (!data.subject.trim() || !data.body.trim()) return { error: "Add a subject and message." };
  if (!data.clientIds.length) return { error: "Choose at least one client." };
  const blocked = ((await db.setting.findUnique({ where: { key: "messaging.blocked" } }))?.value ?? []) as string[];
  const recipients = data.clientIds.filter((id) => !blocked.includes(id));
  for (const clientId of recipients) {
    let conv = await db.conversation.findFirst({ where: { clientId, archived: false } });
    if (!conv) conv = await db.conversation.create({ data: { clientId } });
    await db.message.create({ data: { conversationId: conv.id, sender: "PROVIDER", authorName: `${user.firstName} ${user.lastName}`, body: `${data.subject.trim()}\n\n${data.body.trim()}` } });
    await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
  }
  await db.announcement.create({ data: { subject: data.subject.trim(), body: data.body.trim(), clientIds: recipients } });
  await audit(user.id, "send", "Announcement", undefined, `${recipients.length} recipients`);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function setBlocked(clientId: string, blocked: boolean): Promise<R> {
  await requireUser();
  const s = await db.setting.findUnique({ where: { key: "messaging.blocked" } });
  const list = new Set((s?.value ?? []) as string[]);
  if (blocked) list.add(clientId);
  else list.delete(clientId);
  await db.setting.upsert({ where: { key: "messaging.blocked" }, create: { key: "messaging.blocked", value: [...list] }, update: { value: [...list] } });
  revalidatePath("/inbox");
  revalidatePath("/settings/messaging");
  return { ok: true };
}
