"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { editNote, rewriteSection, type LabeledUtterance } from "@/lib/ai/clinical";
import { addNoteFromTemplate, processSession, sourceForSession } from "@/lib/sessions";
import { runComplianceForNote } from "@/lib/compliance";
import { deleteUpload } from "@/lib/storage";
import { stripHtml } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/sanitize";

type Section = { id: string; title: string; html: string; rating?: "up" | "down" | null };
type R = { error?: string; ok?: boolean; html?: string; changed?: boolean; declined?: string[] };

async function loadDoc(docId: string) {
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId }, include: { template: true } });
  return { doc, sections: doc.sections as unknown as Section[] };
}

function refresh(sessionId: string | null) {
  if (sessionId) revalidatePath(`/sessions/${sessionId}`);
}

export async function saveSection(docId: string, sectionId: string, html: string): Promise<R> {
  await requireUser();
  const { doc, sections } = await loadDoc(docId);
  if (doc.status === "SIGNED") return { error: "This note is signed. Unsign it to make changes." };
  const clean = sanitizeRichHtml(html);
  await db.noteDocument.update({ where: { id: docId }, data: { sections: sections.map((s) => (s.id === sectionId ? { ...s, html: clean } : s)) } });
  return { ok: true };
}

export async function rateSection(docId: string, sectionId: string, rating: "up" | "down" | null): Promise<R> {
  await requireUser();
  const { sections } = await loadDoc(docId);
  await db.noteDocument.update({ where: { id: docId }, data: { sections: sections.map((s) => (s.id === sectionId ? { ...s, rating } : s)) } });
  return { ok: true };
}

export async function regenerateSection(docId: string, sectionId: string, instruction: string): Promise<R> {
  const user = await requireUser();
  const { doc, sections } = await loadDoc(docId);
  if (doc.status === "SIGNED") return { error: "Unsign the note before regenerating." };
  if (!doc.sessionId) return { error: "This note isn't linked to a session." };
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return { error: "Section not found" };
  try {
    const templateSections = (doc.template?.sections ?? []) as unknown as { id: string; instructions: string }[];
    const { ctx, source } = await sourceForSession(doc.sessionId);
    const { html, declined } = await rewriteSection({ ...section, instructions: templateSections.find((t) => t.id === sectionId)?.instructions }, instruction, source, ctx);
    if (declined.length) {
      await audit(user.id, "ai-edit-declined", "NoteDocument", docId, declined.join(" | ").slice(0, 1000));
      return { ok: true, changed: false, declined };
    }
    await db.noteDocument.update({ where: { id: docId }, data: { sections: sections.map((s) => (s.id === sectionId ? { ...s, html, rating: null } : s)) } });
    refresh(doc.sessionId);
    return { ok: true, html };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Regeneration failed" };
  }
}

export async function editWithAssistant(docId: string, instruction: string): Promise<R> {
  const user = await requireUser();
  const { doc, sections } = await loadDoc(docId);
  if (doc.status === "SIGNED") return { error: "Unsign the note before editing." };
  if (!doc.sessionId) return { error: "This note isn't linked to a session." };
  try {
    const { ctx, source } = await sourceForSession(doc.sessionId);
    const { sections: updated, declined } = await editNote(sections, instruction, source, ctx);
    const changed = updated.some((u, i) => u.html !== sections[i].html);
    if (changed) await db.noteDocument.update({ where: { id: docId }, data: { sections: updated } });
    if (declined.length) await audit(user.id, "ai-edit-declined", "NoteDocument", docId, declined.join(" | ").slice(0, 1000));
    refresh(doc.sessionId);
    return { ok: true, changed, declined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Edit failed" };
  }
}

export async function signNote(docId: string): Promise<R> {
  const user = await requireUser();
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId } });
  const credential = user.license ? `, ${user.license}` : "";
  await db.noteDocument.update({
    where: { id: docId },
    data: { status: "SIGNED", signedAt: new Date(), signedBy: user.id, signature: `${user.firstName} ${user.lastName}${credential}` },
  });
  await audit(user.id, "sign", "NoteDocument", docId);
  refresh(doc.sessionId);
  return { ok: true };
}

export async function unsignNote(docId: string): Promise<R> {
  const user = await requireUser();
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId } });
  await db.noteDocument.update({ where: { id: docId }, data: { status: "DRAFT", signedAt: null, signedBy: null, signature: null } });
  await audit(user.id, "unsign", "NoteDocument", docId);
  refresh(doc.sessionId);
  return { ok: true };
}

export async function addNote(sessionId: string, templateId: string): Promise<R> {
  await requireUser();
  try {
    await addNoteFromTemplate(sessionId, templateId);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    refresh(sessionId);
    return { error: e instanceof Error ? e.message : "Couldn't generate the note" };
  }
}

export async function addBlankNote(sessionId: string, templateId: string): Promise<R> {
  await requireUser();
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const t = await db.noteTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const sections = (t.sections as unknown as { id: string; title: string }[]).map((x) => ({ id: x.id, title: x.title, html: "<p></p>" }));
  await db.noteDocument.create({ data: { sessionId, clientId: s.clientId, templateId, title: t.name, sections, status: "DRAFT" } });
  refresh(sessionId);
  return { ok: true };
}

export async function deleteNote(docId: string): Promise<R> {
  const user = await requireUser();
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId } });
  if (doc.status === "SIGNED") return { error: "Signed notes can't be deleted. Unsign first." };
  await db.noteDocument.delete({ where: { id: docId } });
  await audit(user.id, "delete", "NoteDocument", docId);
  refresh(doc.sessionId);
  return { ok: true };
}

export async function runCompliance(docId: string, groupId?: string): Promise<R> {
  await requireUser();
  try {
    const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId } });
    await runComplianceForNote(docId, groupId);
    refresh(doc.sessionId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Compliance check failed" };
  }
}

export async function updateSessionDetails(
  sessionId: string,
  data: { clientId: string | null; title: string; startedAt: string; durationMin: number; captureMode: string; cpt: string; feeCents: number | null; billingType: string },
): Promise<R> {
  const user = await requireUser();
  const startedAt = new Date(data.startedAt);
  await db.session.update({
    where: { id: sessionId },
    data: {
      clientId: data.clientId || null,
      title: data.title || null,
      startedAt,
      durationSec: Math.max(0, Math.round(data.durationMin * 60)),
      endedAt: new Date(startedAt.getTime() + data.durationMin * 60000),
      captureMode: data.captureMode,
      cpt: data.cpt || null,
      feeCents: data.feeCents,
      billingType: data.billingType,
    },
  });
  await db.noteDocument.updateMany({ where: { sessionId }, data: { clientId: data.clientId || null } });
  await audit(user.id, "update", "Session", sessionId);
  refresh(sessionId);
  return { ok: true };
}

export async function swapSpeakers(sessionId: string): Promise<R> {
  await requireUser();
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const t = (s.transcript as unknown as LabeledUtterance[]).map((u) => ({
    ...u,
    speaker: u.speaker === "PROVIDER" ? "CLIENT" : u.speaker === "CLIENT" ? "PROVIDER" : u.speaker,
  }));
  const a = (s.analytics ?? {}) as { providerSec?: number; clientSec?: number; silenceSec?: number };
  await db.session.update({ where: { id: sessionId }, data: { transcript: t, analytics: { ...a, providerSec: a.clientSec, clientSec: a.providerSec } } });
  refresh(sessionId);
  return { ok: true };
}

export async function retryProcessing(sessionId: string, regenerateNotes: boolean): Promise<R> {
  await requireUser();
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { documents: true } });
  if (s.documents.some((d) => d.status === "SIGNED")) return { error: "Unsign existing notes before regenerating them." };
  await db.noteDocument.deleteMany({ where: { sessionId } });
  await db.session.update({
    where: { id: sessionId },
    data: { status: s.audioPath && !regenerateNotes ? "TRANSCRIBING" : "GENERATING", error: null, ...(regenerateNotes ? {} : { transcript: [] }) },
  });
  void processSession(sessionId);
  refresh(sessionId);
  return { ok: true };
}

export async function deleteSession(sessionId: string) {
  const user = await requireUser();
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { documents: true } });
  if (s.documents.some((d) => d.status === "SIGNED")) return { error: "This session has signed notes. Unsign them first." };
  await db.session.delete({ where: { id: sessionId } });
  await deleteUpload(s.audioPath);
  await audit(user.id, "delete", "Session", sessionId);
  redirect(s.clientId ? `/clients/${s.clientId}` : "/sessions");
}

export async function markSeen(sessionId: string) {
  await requireUser();
  await db.session.update({ where: { id: sessionId }, data: { seenAt: new Date() } });
}

/** Sends a client-facing recap note to the client through secure messaging. */
export async function shareWithClient(docId: string): Promise<R> {
  const user = await requireUser();
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: docId }, include: { session: true } });
  const clientId = doc.clientId ?? doc.session?.clientId;
  if (!clientId) return { error: "Assign this session to a client first." };
  const body = (doc.sections as unknown as Section[]).map((s) => `${s.title}\n${stripHtml(s.html)}`).join("\n\n");
  let conv = await db.conversation.findFirst({ where: { clientId, archived: false } });
  if (!conv) conv = await db.conversation.create({ data: { clientId } });
  await db.message.create({ data: { conversationId: conv.id, sender: "PROVIDER", authorName: `${user.firstName} ${user.lastName}`, body } });
  await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
  await audit(user.id, "share", "NoteDocument", docId);
  return { ok: true };
}
