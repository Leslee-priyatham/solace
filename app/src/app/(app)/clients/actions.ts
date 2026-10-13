"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { nextMrn } from "@/lib/bootstrap";
import { saveUpload, deleteUpload } from "@/lib/storage";
import { generateTreatmentPlan, generateTreatmentSummary, type PlanArea } from "@/lib/ai/clinical";
import { stripHtml, date } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { noteContext } from "@/lib/sessions";

type R = { error?: string; ok?: boolean; id?: string };

const clientSchema = z.object({
  kind: z.enum(["INDIVIDUAL", "COUPLE", "FAMILY"]).default("INDIVIDUAL"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  preferredName: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  dob: z.string().optional(),
  pronouns: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "PROSPECT", "INACTIVE", "DISCHARGED"]).default("ACTIVE"),
  providerId: z.string().optional(),
  billingType: z.enum(["SELF_PAY", "INSURANCE"]).default("SELF_PAY"),
  defaultServiceId: z.string().optional(),
  notes: z.string().optional(),
});

function parseClientForm(form: FormData) {
  const parsed = clientSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  const modalities = form.getAll("modalities").map(String).filter(Boolean);
  const diagnoses = form
    .getAll("diagnoses")
    .map(String)
    .filter(Boolean)
    .map((v, i) => {
      const [code, ...rest] = v.split("|");
      return { code, description: rest.join("|") || code, sortOrder: i };
    });
  const tags = form.getAll("tags").map(String).filter(Boolean);
  return {
    data: {
      kind: d.kind,
      firstName: d.firstName,
      lastName: d.lastName,
      preferredName: d.preferredName || null,
      email: d.email || null,
      phone: d.phone || null,
      dob: d.dob ? new Date(d.dob) : null,
      pronouns: d.pronouns || null,
      gender: d.gender || null,
      address: d.address || null,
      status: d.status,
      providerId: d.providerId || null,
      billingType: d.billingType,
      defaultServiceId: d.defaultServiceId || null,
      notes: d.notes || null,
      modalities,
    },
    diagnoses,
    tags,
  } as const;
}

async function tagConnect(names: string[]) {
  const out: { id: string }[] = [];
  for (const name of names) {
    const tag = await db.tag.upsert({ where: { name }, create: { name }, update: {} });
    out.push({ id: tag.id });
  }
  return out;
}

export async function createClient(_: R | undefined, form: FormData): Promise<R> {
  const user = await requireUser();
  const parsed = parseClientForm(form);
  if ("error" in parsed) return { error: parsed.error };
  const client = await db.client.create({
    data: {
      ...parsed.data,
      providerId: parsed.data.providerId ?? user.id,
      mrn: await nextMrn(),
      portalToken: token(),
      diagnoses: { create: parsed.diagnoses },
      tags: { connect: await tagConnect(parsed.tags) },
    },
  });
  const partner = String(form.get("partnerName") ?? "").trim();
  if (partner) {
    await db.clientContact.create({
      data: { clientId: client.id, name: partner, email: String(form.get("partnerEmail") ?? "") || null, relationship: parsed.data.kind === "COUPLE" ? "Partner" : "Family member", isParticipant: true },
    });
  }
  await audit(user.id, "create", "Client", client.id);
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, _: R | undefined, form: FormData): Promise<R> {
  const user = await requireUser();
  const parsed = parseClientForm(form);
  if ("error" in parsed) return { error: parsed.error };
  await db.client.update({
    where: { id },
    data: {
      ...parsed.data,
      diagnoses: { deleteMany: {}, create: parsed.diagnoses },
      tags: { set: await tagConnect(parsed.tags) },
    },
  });
  await audit(user.id, "update", "Client", id);
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function setClientStatus(id: string, status: string): Promise<R> {
  const user = await requireUser();
  await db.client.update({ where: { id }, data: { status } });
  await audit(user.id, "status", "Client", id, status);
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function deleteClient(id: string) {
  const user = await requireUser();
  const signed = await db.noteDocument.count({ where: { clientId: id, status: "SIGNED" } });
  if (signed) return { error: `This client has ${signed} signed note(s). Discharge the client instead of deleting the record.` };
  const files = await db.clientFile.findMany({ where: { clientId: id } });
  const sessions = await db.session.findMany({ where: { clientId: id }, select: { id: true, audioPath: true } });
  await db.session.deleteMany({ where: { clientId: id } });
  await db.client.delete({ where: { id } });
  await Promise.all([...files.map((f) => deleteUpload(f.path)), ...sessions.map((s) => deleteUpload(s.audioPath))]);
  await audit(user.id, "delete", "Client", id);
  redirect("/clients");
}

export async function regeneratePortalLink(id: string): Promise<R> {
  await requireUser();
  await db.client.update({ where: { id }, data: { portalToken: token() } });
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function updateNotePrefs(id: string, prefs: { templateId?: string; clientNoteTemplateId?: string | null }): Promise<R> {
  await requireUser();
  const c = await db.client.findUniqueOrThrow({ where: { id } });
  await db.client.update({ where: { id }, data: { notePrefs: { ...((c.notePrefs ?? {}) as object), ...prefs } } });
  revalidatePath(`/clients/${id}`);
  return { ok: true };
}

// ───────── Contacts ─────────

export async function saveContact(clientId: string, data: { id?: string; name: string; relationship?: string; email?: string; phone?: string; isEmergency?: boolean; isParticipant?: boolean }): Promise<R> {
  await requireUser();
  if (!data.name.trim()) return { error: "Name is required" };
  const payload = {
    name: data.name.trim(),
    relationship: data.relationship || null,
    email: data.email || null,
    phone: data.phone || null,
    isEmergency: !!data.isEmergency,
    isParticipant: !!data.isParticipant,
  };
  if (data.id) await db.clientContact.update({ where: { id: data.id }, data: payload });
  else await db.clientContact.create({ data: { clientId, ...payload } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteContact(clientId: string, id: string): Promise<R> {
  await requireUser();
  await db.clientContact.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

// ───────── Chart notes ─────────

export async function saveChartNote(clientId: string, data: { id?: string; title: string; html: string; date: string }): Promise<R> {
  const user = await requireUser();
  const payload = { title: data.title.trim() || "Chart note", html: sanitizeRichHtml(data.html), date: new Date(data.date) };
  const note = data.id
    ? await db.chartNote.update({ where: { id: data.id }, data: payload })
    : await db.chartNote.create({ data: { clientId, authorId: user.id, ...payload } });
  await audit(user.id, data.id ? "update" : "create", "ChartNote", note.id);
  revalidatePath(`/clients/${clientId}/chart-notes`);
  return { ok: true, id: note.id };
}

export async function deleteChartNote(clientId: string, id: string): Promise<R> {
  const user = await requireUser();
  await db.chartNote.delete({ where: { id } });
  await audit(user.id, "delete", "ChartNote", id);
  revalidatePath(`/clients/${clientId}/chart-notes`);
  return { ok: true };
}

// ───────── Files ─────────

export async function uploadClientFiles(clientId: string, form: FormData): Promise<R> {
  const user = await requireUser();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one file." };
  for (const f of files) {
    const path = await saveUpload(`clients/${clientId}`, f.name, Buffer.from(await f.arrayBuffer()));
    const row = await db.clientFile.create({ data: { clientId, name: f.name, mime: f.type || "application/octet-stream", size: f.size, path } });
    await audit(user.id, "upload", "ClientFile", row.id, f.name);
  }
  revalidatePath(`/clients/${clientId}/files`);
  return { ok: true };
}

export async function deleteClientFile(clientId: string, id: string): Promise<R> {
  const user = await requireUser();
  const f = await db.clientFile.delete({ where: { id } });
  await deleteUpload(f.path);
  await audit(user.id, "delete", "ClientFile", id, f.name);
  revalidatePath(`/clients/${clientId}/files`);
  return { ok: true };
}

// ───────── Treatment plan & summary ─────────

async function clinicalRecord(clientId: string) {
  const c = await db.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      diagnoses: true,
      measureScores: { orderBy: { takenAt: "asc" } },
      chartNotes: { orderBy: { date: "asc" } },
      sessions: { orderBy: { startedAt: "asc" }, include: { documents: true } },
      formRequests: { where: { status: "COMPLETED" }, include: { form: true } },
    },
  });
  const parts: string[] = [];
  parts.push(`Client: ${c.firstName} ${c.lastName}. Diagnoses: ${c.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ") || "none"}. Modalities: ${(c.modalities as string[]).join(", ") || "none"}.`);
  if (c.notes) parts.push(`Clinician notes: ${c.notes}`);
  for (const s of c.sessions) {
    const docs = s.documents.filter((d) => d.status !== "ERROR");
    const body = docs.length
      ? docs.map((d) => (d.sections as unknown as { title: string; html: string }[]).map((x) => `${x.title}: ${stripHtml(x.html)}`).join("\n")).join("\n")
      : s.synopsis ?? "";
    if (body) parts.push(`Session ${date(s.startedAt)}:\n${body.slice(0, 6000)}`);
  }
  for (const n of c.chartNotes) parts.push(`Chart note ${date(n.date)} — ${n.title}: ${stripHtml(n.html).slice(0, 2000)}`);
  for (const m of c.measureScores) parts.push(`${m.measure} on ${date(m.takenAt)}: ${m.score} (${m.severity})`);
  for (const f of c.formRequests) {
    if (f.form.kind === "INTAKE") parts.push(`Intake form "${f.form.name}" answers: ${JSON.stringify(f.answers).slice(0, 4000)}`);
  }
  return { client: c, text: parts.join("\n\n") };
}

async function ctxForClient(clientId: string) {
  const latest = await db.session.findFirst({ where: { clientId }, orderBy: { startedAt: "desc" } });
  if (latest) return noteContext(latest.id);
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId }, include: { diagnoses: true } });
  return { clientTerm: "Client", providerTerm: "Therapist", modalities: c.modalities as string[], diagnoses: c.diagnoses.map((d) => `${d.code} ${d.description}`) };
}

export async function generatePlan(clientId: string, instruction?: string): Promise<R> {
  const user = await requireUser();
  try {
    const { text } = await clinicalRecord(clientId);
    const existing = await db.treatmentPlan.findUnique({ where: { clientId } });
    const material = instruction && existing
      ? `${text}\n\nCurrent plan:\n${stripHtml(existing.caseSnapshot)}\n${JSON.stringify(existing.areas)}\n\nClinician's requested changes: ${instruction}`
      : text;
    const plan = await generateTreatmentPlan(material, await ctxForClient(clientId));
    await db.treatmentPlan.upsert({
      where: { clientId },
      create: { clientId, caseSnapshot: plan.caseSnapshot, areas: plan.areas, generatedAt: new Date() },
      update: { caseSnapshot: plan.caseSnapshot, areas: plan.areas, generatedAt: new Date() },
    });
    await audit(user.id, "generate", "TreatmentPlan", clientId);
    revalidatePath(`/clients/${clientId}/treatment-plan`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't generate the plan" };
  }
}

export async function savePlan(clientId: string, data: { caseSnapshot: string; areas: PlanArea[] }): Promise<R> {
  const user = await requireUser();
  const caseSnapshot = sanitizeRichHtml(data.caseSnapshot);
  await db.treatmentPlan.upsert({
    where: { clientId },
    create: { clientId, caseSnapshot, areas: data.areas as object[] },
    update: { caseSnapshot, areas: data.areas as object[] },
  });
  await audit(user.id, "update", "TreatmentPlan", clientId);
  revalidatePath(`/clients/${clientId}/treatment-plan`);
  return { ok: true };
}

export async function deletePlan(clientId: string): Promise<R> {
  await requireUser();
  await db.treatmentPlan.deleteMany({ where: { clientId } });
  revalidatePath(`/clients/${clientId}/treatment-plan`);
  return { ok: true };
}

export async function generateSummary(clientId: string): Promise<R> {
  const user = await requireUser();
  try {
    const { text, client } = await clinicalRecord(clientId);
    const content = await generateTreatmentSummary(text, await ctxForClient(clientId));
    const last = client.sessions[client.sessions.length - 1];
    await db.treatmentSummary.upsert({
      where: { clientId },
      create: { clientId, content: content as object, sourceSessionId: last?.id, generatedAt: new Date() },
      update: { content: content as object, sourceSessionId: last?.id, generatedAt: new Date() },
    });
    await audit(user.id, "generate", "TreatmentSummary", clientId);
    revalidatePath(`/clients/${clientId}/summary`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't generate the summary" };
  }
}

export async function shareSummaryToPortal(clientId: string, text: string | null): Promise<R> {
  const user = await requireUser();
  await db.client.update({ where: { id: clientId }, data: { portalSummary: text } });
  await audit(user.id, text ? "share" : "revoke", "TreatmentSummary", clientId);
  revalidatePath(`/clients/${clientId}/summary`);
  return { ok: true };
}

export async function addMeasureScore(clientId: string, measure: string, score: number, takenAt: string): Promise<R> {
  await requireUser();
  const { severity } = await import("@/lib/library");
  await db.measureScore.create({ data: { clientId, measure, score, severity: severity(measure, score), takenAt: new Date(takenAt) } });
  revalidatePath(`/clients/${clientId}/insights`);
  return { ok: true };
}
