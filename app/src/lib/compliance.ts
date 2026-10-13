import "server-only";
import { db } from "./db";
import { checkCompliance, sectionsToText } from "./ai/clinical";

type Criterion = { id: string; title: string; description: string };

export async function defaultGroupId() {
  const p = await db.practice.findFirst();
  const configured = ((p?.settings ?? {}) as { compliance?: { groupId?: string } }).compliance?.groupId;
  if (configured) return configured;
  return (await db.complianceCriteriaGroup.findFirst({ orderBy: { createdAt: "asc" } }))?.id;
}

export async function runComplianceForNote(noteDocumentId: string, groupId?: string) {
  const doc = await db.noteDocument.findUniqueOrThrow({ where: { id: noteDocumentId } });
  const gid = groupId ?? (await defaultGroupId());
  if (!gid) throw new Error("No compliance criteria groups exist.");
  const group = await db.complianceCriteriaGroup.findUniqueOrThrow({ where: { id: gid } });
  const check = await db.complianceCheck.create({ data: { groupId: gid, noteDocumentId } });
  try {
    const sections = doc.sections as unknown as { title: string; html: string }[];
    const signedLine = doc.signedAt ? `\n\nSigned electronically by ${doc.signedBy} on ${doc.signedAt.toISOString()}` : "\n\n(Not yet signed)";
    const result = await checkCompliance(sectionsToText(sections) + signedLine, group.criteria as unknown as Criterion[]);
    const stored = { ...result, groupId: gid, groupName: group.name, checkedAt: new Date().toISOString() };
    await db.complianceCheck.update({ where: { id: check.id }, data: { status: "DONE", result: stored } });
    await db.noteDocument.update({ where: { id: noteDocumentId }, data: { compliance: stored } });
    return stored;
  } catch (e) {
    await db.complianceCheck.update({ where: { id: check.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
}

export async function runComplianceForText(text: string, fileName: string, groupId: string) {
  const group = await db.complianceCriteriaGroup.findUniqueOrThrow({ where: { id: groupId } });
  const check = await db.complianceCheck.create({ data: { groupId, fileName } });
  try {
    const result = await checkCompliance(text, group.criteria as unknown as Criterion[]);
    const stored = { ...result, groupId, groupName: group.name, checkedAt: new Date().toISOString() };
    await db.complianceCheck.update({ where: { id: check.id }, data: { status: "DONE", result: stored } });
    return { id: check.id, ...stored };
  } catch (e) {
    await db.complianceCheck.update({ where: { id: check.id }, data: { status: "ERROR", error: e instanceof Error ? e.message : String(e) } });
    throw e;
  }
}
