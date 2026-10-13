"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { extractText } from "@/lib/storage";
import { formFromDocument } from "@/lib/ai/clinical";
import type { FormField } from "@/lib/forms";

type R = { error?: string; ok?: boolean; id?: string; sent?: number };
const rid = () => Math.random().toString(36).slice(2, 10);

export async function createBlankForm() {
  const user = await requireUser();
  const f = await db.form.create({ data: { name: "Untitled form", kind: "INTAKE", fields: [{ id: rid(), type: "short_text", label: "Full name", required: true }] } });
  await audit(user.id, "create", "Form", f.id);
  redirect(`/forms/${f.id}`);
}

export async function useLibraryForm(libraryId: string) {
  const user = await requireUser();
  const lib = await db.form.findUniqueOrThrow({ where: { id: libraryId } });
  const f = await db.form.create({ data: { name: lib.name, description: lib.description, kind: lib.kind, measure: lib.measure, fields: lib.fields ?? [] } });
  await audit(user.id, "create", "Form", f.id, `from library: ${lib.name}`);
  redirect(`/forms/${f.id}`);
}

export async function saveForm(id: string, data: { name: string; description: string; kind: string; measure: string | null; fields: FormField[] }): Promise<R> {
  await requireUser();
  if (!data.name.trim()) return { error: "Give the form a name." };
  await db.form.update({
    where: { id },
    data: { name: data.name.trim(), description: data.description || null, kind: data.kind, measure: data.measure || null, fields: data.fields },
  });
  revalidatePath("/forms");
  revalidatePath(`/forms/${id}`);
  return { ok: true };
}

export async function deleteForm(id: string): Promise<R> {
  const user = await requireUser();
  const used = await db.formRequest.count({ where: { formId: id } });
  if (used) {
    await db.form.update({ where: { id }, data: { archived: true } });
  } else {
    await db.form.delete({ where: { id } });
  }
  await audit(user.id, used ? "archive" : "delete", "Form", id);
  revalidatePath("/forms");
  return { ok: true };
}

export async function convertPdfToForm(form: FormData): Promise<R> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a PDF or text file." };
  try {
    const text = await extractText(Buffer.from(await file.arrayBuffer()), file.type || "application/pdf");
    if (text.trim().length < 20) return { error: "We couldn't read any text in that file. Scanned images aren't supported — try a text-based PDF." };
    const result = await formFromDocument(text);
    const f = await db.form.create({
      data: {
        name: result.name || file.name.replace(/\.[^.]+$/, ""),
        description: result.description,
        kind: ["INTAKE", "CONSENT", "ASSESSMENT", "OTHER"].includes(result.kind) ? result.kind : "OTHER",
        fields: (result.fields ?? []).map((x) => ({ ...x, id: rid() })),
      },
    });
    await audit(user.id, "convert", "Form", f.id, file.name);
    return { ok: true, id: f.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Conversion failed" };
  }
}

// ───────── Packets ─────────

export async function savePacket(data: { id?: string; name: string; description?: string; formIds: string[] }): Promise<R> {
  await requireUser();
  if (!data.name.trim()) return { error: "Give the packet a name." };
  if (!data.formIds.length) return { error: "Add at least one form." };
  const payload = { name: data.name.trim(), description: data.description || null, formIds: data.formIds };
  const p = data.id ? await db.formPacket.update({ where: { id: data.id }, data: payload }) : await db.formPacket.create({ data: payload });
  revalidatePath("/forms/packets");
  return { ok: true, id: p.id };
}

export async function deletePacket(id: string): Promise<R> {
  await requireUser();
  await db.formPacket.delete({ where: { id } });
  revalidatePath("/forms/packets");
  return { ok: true };
}

// ───────── Requests ─────────

export async function getSendOptions() {
  await requireUser();
  const [clients, forms, packets] = await Promise.all([
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT"] } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
    db.form.findMany({ where: { isLibrary: false, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.formPacket.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, formIds: true } }),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email })),
    forms,
    packets: packets.map((p) => ({ id: p.id, name: p.name, count: (p.formIds as string[]).length })),
  };
}

export async function sendForms(data: { clientIds: string[]; formIds: string[]; packetId?: string; message?: string }): Promise<R> {
  const user = await requireUser();
  let formIds = data.formIds;
  if (data.packetId) {
    const p = await db.formPacket.findUniqueOrThrow({ where: { id: data.packetId } });
    formIds = [...new Set([...(p.formIds as string[]), ...formIds])];
  }
  if (!data.clientIds.length || !formIds.length) return { error: "Choose at least one client and one form." };
  let sent = 0;
  for (const clientId of data.clientIds) {
    const titles: string[] = [];
    for (const formId of formIds) {
      const existing = await db.formRequest.findFirst({ where: { clientId, formId, status: { in: ["SENT", "IN_PROGRESS"] } } });
      if (existing) continue;
      const f = await db.form.findUniqueOrThrow({ where: { id: formId } });
      await db.formRequest.create({ data: { clientId, formId, packetId: data.packetId ?? null, token: token() } });
      titles.push(f.name);
      sent++;
    }
    if (titles.length) {
      let conv = await db.conversation.findFirst({ where: { clientId, archived: false } });
      if (!conv) conv = await db.conversation.create({ data: { clientId } });
      const body = `${data.message?.trim() ? `${data.message.trim()}\n\n` : ""}You have ${titles.length === 1 ? "a form" : `${titles.length} forms`} to complete in your client portal: ${titles.join(", ")}.`;
      await db.message.create({ data: { conversationId: conv.id, sender: "PROVIDER", authorName: `${user.firstName} ${user.lastName}`, body } });
      await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
    }
    revalidatePath(`/clients/${clientId}/forms`);
  }
  await audit(user.id, "send", "FormRequest", undefined, `${sent} requests`);
  return { ok: true, sent };
}

export async function revokeRequest(id: string): Promise<R> {
  const user = await requireUser();
  const r = await db.formRequest.update({ where: { id }, data: { status: "REVOKED" } });
  await audit(user.id, "revoke", "FormRequest", id);
  revalidatePath(`/clients/${r.clientId}/forms`);
  return { ok: true };
}

export async function remindRequest(id: string): Promise<R> {
  const user = await requireUser();
  const r = await db.formRequest.findUniqueOrThrow({ where: { id }, include: { form: true } });
  let conv = await db.conversation.findFirst({ where: { clientId: r.clientId, archived: false } });
  if (!conv) conv = await db.conversation.create({ data: { clientId: r.clientId } });
  await db.message.create({
    data: { conversationId: conv.id, sender: "PROVIDER", authorName: `${user.firstName} ${user.lastName}`, body: `Friendly reminder: "${r.form.name}" is waiting for you in your client portal.` },
  });
  await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
  await db.formRequest.update({ where: { id }, data: { remindedAt: new Date() } });
  revalidatePath(`/clients/${r.clientId}/forms`);
  return { ok: true };
}
