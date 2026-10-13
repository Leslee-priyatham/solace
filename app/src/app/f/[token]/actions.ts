"use server";

import { db } from "@/lib/db";
import { measureResult, validateAnswers, type Answers, type FormField } from "@/lib/forms";

/** Public: a client saving or submitting a form via its private link. */
export async function submitForm(token: string, answers: Answers, final: boolean): Promise<{ error?: string; ok?: boolean }> {
  const r = await db.formRequest.findUnique({ where: { token }, include: { form: true } });
  if (!r || r.status === "REVOKED") return { error: "This form link is no longer active. Please contact your clinician." };
  if (r.status === "COMPLETED") return { error: "This form has already been submitted." };
  const fields = r.form.fields as unknown as FormField[];
  if (!final) {
    await db.formRequest.update({ where: { id: r.id }, data: { answers, status: "IN_PROGRESS" } });
    return { ok: true };
  }
  const problem = validateAnswers(fields, answers);
  if (problem) return { error: problem };
  const signature = fields.find((f) => f.type === "signature");
  const measure = measureResult(r.form.measure, fields, answers);
  await db.formRequest.update({
    where: { id: r.id },
    data: {
      answers,
      status: "COMPLETED",
      completedAt: new Date(),
      score: measure?.score ?? null,
      signatureName: signature ? String(answers[signature.id] ?? "") || null : null,
    },
  });
  if (measure && r.form.measure) {
    await db.measureScore.create({ data: { clientId: r.clientId, measure: r.form.measure, score: measure.score, severity: measure.severity, formRequestId: r.id } });
  }
  if (r.form.kind === "CONSENT" && r.form.name.toLowerCase().includes("text message")) {
    await db.client.update({ where: { id: r.clientId }, data: { smsConsent: true } });
  }
  return { ok: true };
}
