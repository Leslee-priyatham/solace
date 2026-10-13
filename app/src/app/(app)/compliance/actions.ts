"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { extractText } from "@/lib/storage";
import { runComplianceForNote, runComplianceForText } from "@/lib/compliance";

type R = { error?: string; ok?: boolean; id?: string };

export async function checkUploadedNote(form: FormData): Promise<R> {
  const user = await requireUser();
  const groupId = String(form.get("groupId") ?? "");
  const file = form.get("file");
  if (!groupId) return { error: "Choose a criteria group." };
  if (!(file instanceof File) || !file.size) return { error: "Upload a PDF or text file of the note." };
  if (file.size > 50 * 1024 * 1024) return { error: "Files can be up to 50 MB." };
  try {
    // The upload is read in memory only — notes checked this way are not stored.
    const text = await extractText(Buffer.from(await file.arrayBuffer()), file.type || "application/pdf");
    if (text.trim().length < 40) return { error: "We couldn't read text from that file. Scanned images aren't supported." };
    const r = await runComplianceForText(text.slice(0, 120000), file.name, groupId);
    await audit(user.id, "compliance", "File", undefined, file.name);
    revalidatePath("/compliance");
    return { ok: true, id: r.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Compliance check failed" };
  }
}

export async function checkExistingNote(noteId: string, groupId: string): Promise<R> {
  await requireUser();
  try {
    await runComplianceForNote(noteId, groupId);
    const check = await db.complianceCheck.findFirst({ where: { noteDocumentId: noteId }, orderBy: { createdAt: "desc" } });
    revalidatePath("/compliance");
    return { ok: true, id: check?.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Compliance check failed" };
  }
}

export async function saveCriteriaGroup(data: { id?: string; name: string; description: string; criteria: { id: string; title: string; description: string }[] }): Promise<R> {
  await requireUser();
  if (!data.name.trim()) return { error: "Name the criteria group." };
  const criteria = data.criteria.filter((c) => c.title.trim()).map((c) => ({ ...c, id: c.id || c.title.toLowerCase().replace(/[^a-z0-9]+/g, "_") }));
  if (!criteria.length) return { error: "Add at least one criterion." };
  if (data.id) {
    const g = await db.complianceCriteriaGroup.findUniqueOrThrow({ where: { id: data.id } });
    if (g.isSystem) return { error: "Built-in groups can't be edited. Duplicate it instead." };
    await db.complianceCriteriaGroup.update({ where: { id: data.id }, data: { name: data.name.trim(), description: data.description || null, criteria } });
  } else {
    await db.complianceCriteriaGroup.create({ data: { name: data.name.trim(), description: data.description || null, criteria } });
  }
  revalidatePath("/settings/compliance");
  revalidatePath("/compliance");
  return { ok: true };
}

export async function deleteCriteriaGroup(id: string): Promise<R> {
  await requireUser();
  const g = await db.complianceCriteriaGroup.findUniqueOrThrow({ where: { id } });
  if (g.isSystem) return { error: "Built-in groups can't be deleted." };
  await db.complianceCriteriaGroup.delete({ where: { id } });
  revalidatePath("/settings/compliance");
  return { ok: true };
}

export async function saveComplianceSettings(data: { autoRun: boolean; groupId: string }): Promise<R> {
  await requireUser();
  const p = await db.practice.findFirstOrThrow();
  const settings = (p.settings ?? {}) as Record<string, unknown>;
  await db.practice.update({ where: { id: p.id }, data: { settings: { ...settings, compliance: { autoRun: data.autoRun, groupId: data.groupId || undefined } } } });
  revalidatePath("/settings/compliance");
  return { ok: true };
}
