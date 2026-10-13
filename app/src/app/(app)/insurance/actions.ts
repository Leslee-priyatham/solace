"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { nextClaimNumber, nextInvoiceNumber, refreshInvoice } from "@/lib/billing";
import { money } from "@/lib/format";

type R = { error?: string; ok?: boolean; id?: string };
type History = { at: string; status: string; note: string }[];

function refresh(clientId?: string) {
  revalidatePath("/insurance", "layout");
  if (clientId) revalidatePath(`/clients/${clientId}/billing`);
}

// ───────── Payers ─────────

export async function savePayer(data: { id?: string; name: string; payerCode: string; address?: string; phone?: string }): Promise<R> {
  await requireUser();
  if (!data.name.trim() || !data.payerCode.trim()) return { error: "Payer name and payer ID are required." };
  const payload = { name: data.name.trim(), payerCode: data.payerCode.trim(), address: data.address || null, phone: data.phone || null };
  const p = data.id ? await db.payer.update({ where: { id: data.id }, data: payload }) : await db.payer.create({ data: payload });
  refresh();
  revalidatePath("/settings/payers");
  return { ok: true, id: p.id };
}

export async function deletePayer(id: string): Promise<R> {
  await requireUser();
  if (await db.insurancePolicy.count({ where: { payerId: id } })) return { error: "Clients have policies with this payer." };
  await db.payer.delete({ where: { id } });
  revalidatePath("/settings/payers");
  return { ok: true };
}

export async function saveBillingProfile(data: { id?: string; name: string; kind: string; npi: string; taxId: string; taxonomy?: string; address?: string }): Promise<R> {
  await requireUser();
  if (!/^\d{10}$/.test(data.npi.trim())) return { error: "An NPI is 10 digits." };
  if (!data.taxId.trim()) return { error: "Tax ID is required." };
  const payload = { name: data.name.trim() || "Billing profile", kind: data.kind, npi: data.npi.trim(), taxId: data.taxId.trim(), taxonomy: data.taxonomy || null, address: data.address || null };
  if (data.id) await db.billingProfile.update({ where: { id: data.id }, data: payload });
  else await db.billingProfile.create({ data: payload });
  revalidatePath("/settings/billing-profiles");
  return { ok: true };
}

export async function archiveBillingProfile(id: string, archived: boolean): Promise<R> {
  await requireUser();
  await db.billingProfile.update({ where: { id }, data: { archived } });
  revalidatePath("/settings/billing-profiles");
  return { ok: true };
}

export async function enrollPayer(payerId: string, billingProfileId: string): Promise<R> {
  await requireUser();
  const existing = await db.payerEnrollment.findFirst({ where: { payerId, billingProfileId } });
  if (existing) return { error: "Already enrolled with this payer." };
  await db.payerEnrollment.create({ data: { payerId, billingProfileId, status: "SUBMITTED", submittedAt: new Date() } });
  revalidatePath("/settings/payers");
  return { ok: true };
}

export async function setEnrollmentStatus(id: string, status: string): Promise<R> {
  await requireUser();
  await db.payerEnrollment.update({ where: { id }, data: { status } });
  revalidatePath("/settings/payers");
  return { ok: true };
}

// ───────── Policies & eligibility ─────────

export type PolicyInput = {
  id?: string;
  clientId: string;
  payerId: string;
  priority: number;
  memberId: string;
  groupNumber?: string;
  planName?: string;
  subscriberName?: string;
  relationship: string;
  copayCents?: number | null;
  coinsurancePct?: number | null;
  deductibleCents?: number | null;
};

export async function savePolicy(data: PolicyInput): Promise<R> {
  const user = await requireUser();
  if (!data.payerId || !data.memberId.trim()) return { error: "Payer and member ID are required." };
  const payload = {
    payerId: data.payerId,
    priority: data.priority,
    memberId: data.memberId.trim(),
    groupNumber: data.groupNumber || null,
    planName: data.planName || null,
    subscriberName: data.subscriberName || null,
    relationship: data.relationship,
    copayCents: data.copayCents ?? null,
    coinsurancePct: data.coinsurancePct ?? null,
    deductibleCents: data.deductibleCents ?? null,
  };
  if (data.id) await db.insurancePolicy.update({ where: { id: data.id }, data: payload });
  else await db.insurancePolicy.create({ data: { clientId: data.clientId, ...payload } });
  await db.client.update({ where: { id: data.clientId }, data: { billingType: "INSURANCE" } });
  await audit(user.id, data.id ? "update" : "create", "InsurancePolicy", data.id);
  refresh(data.clientId);
  return { ok: true };
}

export async function archivePolicy(id: string): Promise<R> {
  await requireUser();
  const p = await db.insurancePolicy.update({ where: { id }, data: { archived: true } });
  refresh(p.clientId);
  return { ok: true };
}

/**
 * Eligibility check. Without a clearinghouse connection this returns a simulated 271-style summary
 * built from the policy on file, clearly marked as simulated.
 */
export async function checkEligibility(policyId: string): Promise<R> {
  await requireUser();
  const p = await db.insurancePolicy.findUniqueOrThrow({ where: { id: policyId }, include: { payer: true } });
  const active = p.memberId.length >= 5;
  const eligibility = {
    checkedAt: new Date().toISOString(),
    status: active ? "ACTIVE" : "INACTIVE",
    simulated: true,
    summary: active
      ? `Outpatient mental health covered. Copay ${p.copayCents != null ? money(p.copayCents) : "unknown"}, coinsurance ${p.coinsurancePct ?? "unknown"}%, deductible ${p.deductibleCents != null ? money(p.deductibleCents) : "unknown"}.`
      : "Member ID not recognised by the payer.",
  };
  await db.insurancePolicy.update({ where: { id: policyId }, data: { eligibility } });
  refresh(p.clientId);
  return { ok: true };
}

export async function saveAuthorization(data: { id?: string; clientId: string; authNumber: string; cpt?: string; visitsAllowed?: number | null; startDate: string; endDate?: string }): Promise<R> {
  await requireUser();
  if (!data.authNumber.trim()) return { error: "Authorization number is required." };
  const payload = {
    authNumber: data.authNumber.trim(),
    cpt: data.cpt || null,
    visitsAllowed: data.visitsAllowed ?? null,
    startDate: new Date(data.startDate),
    endDate: data.endDate ? new Date(data.endDate) : null,
  };
  if (data.id) await db.priorAuthorization.update({ where: { id: data.id }, data: payload });
  else await db.priorAuthorization.create({ data: { clientId: data.clientId, ...payload } });
  refresh(data.clientId);
  return { ok: true };
}

export async function archiveAuthorization(id: string): Promise<R> {
  await requireUser();
  const a = await db.priorAuthorization.update({ where: { id }, data: { archived: true } });
  refresh(a.clientId);
  return { ok: true };
}

// ───────── Claims ─────────

export async function createClaim(data: { clientId: string; sessionIds: string[]; policyId?: string; billingProfileId?: string }): Promise<R> {
  const user = await requireUser();
  const client = await db.client.findUniqueOrThrow({ where: { id: data.clientId }, include: { diagnoses: { orderBy: { sortOrder: "asc" } }, policies: { where: { archived: false }, orderBy: { priority: "asc" } } } });
  const policyId = data.policyId || client.policies[0]?.id;
  if (!policyId) return { error: "Add an insurance policy for this client first." };
  const sessions = await db.session.findMany({ where: { id: { in: data.sessionIds }, clientId: data.clientId }, include: { appointment: { include: { service: true } } }, orderBy: { startedAt: "asc" } });
  if (!sessions.length) return { error: "Choose at least one session." };
  const profile = data.billingProfileId || (await db.billingProfile.findFirst({ where: { archived: false } }))?.id;
  const dx = client.diagnoses.slice(0, 12).map((d) => d.code);
  const pointer = dx.slice(0, 4).map((_, i) => String.fromCharCode(65 + i)).join("") || "A";
  const lines = sessions.map((s) => ({
    sessionId: s.id,
    serviceDate: s.startedAt,
    cpt: s.cpt ?? s.appointment?.service?.cpt ?? "90834",
    pos: s.captureMode === "TELEHEALTH" || s.appointment?.modality === "TELEHEALTH" ? "10" : "11",
    modifiers: s.captureMode === "TELEHEALTH" || s.appointment?.modality === "TELEHEALTH" ? "95" : null,
    units: 1,
    chargeCents: s.feeCents ?? s.appointment?.service?.rateCents ?? 0,
    dxPointers: pointer,
  }));
  const claim = await db.claim.create({
    data: {
      number: await nextClaimNumber(),
      clientId: data.clientId,
      policyId,
      billingProfileId: profile ?? null,
      diagnosisCodes: dx,
      totalCents: lines.reduce((n, l) => n + l.chargeCents, 0),
      history: [{ at: new Date().toISOString(), status: "DRAFT", note: "Claim created" }],
      lines: { create: lines },
    },
  });
  await db.session.updateMany({ where: { id: { in: data.sessionIds } }, data: { billingType: "INSURANCE" } });
  await audit(user.id, "create", "Claim", claim.id);
  refresh(data.clientId);
  return { ok: true, id: claim.id };
}

export async function updateClaim(id: string, data: { policyId: string; billingProfileId: string | null; diagnosisCodes: string[]; lines: { id: string; cpt: string; modifiers: string; pos: string; units: number; chargeCents: number; dxPointers: string }[] }): Promise<R> {
  await requireUser();
  const claim = await db.claim.findUniqueOrThrow({ where: { id } });
  if (!["DRAFT", "READY", "REJECTED"].includes(claim.status)) return { error: "Submitted claims can't be edited. Create a corrected claim instead." };
  for (const l of data.lines) {
    await db.claimLine.update({ where: { id: l.id }, data: { cpt: l.cpt, modifiers: l.modifiers || null, pos: l.pos, units: l.units, chargeCents: l.chargeCents, dxPointers: l.dxPointers } });
  }
  await db.claim.update({
    where: { id },
    data: { policyId: data.policyId, billingProfileId: data.billingProfileId, diagnosisCodes: data.diagnosisCodes, totalCents: data.lines.reduce((n, l) => n + l.chargeCents, 0), status: "DRAFT" },
  });
  refresh(claim.clientId);
  return { ok: true };
}

/** Lists what's missing before a claim can be submitted. */
export async function claimReadiness(id: string) {
  const c = await db.claim.findUniqueOrThrow({ where: { id }, include: { client: true, policy: { include: { payer: true } }, billingProfile: true, lines: true } });
  const issues: string[] = [];
  if (!c.billingProfile) issues.push("Choose a billing profile (NPI and Tax ID) — add one in Settings → Billing profiles.");
  if (!c.client.dob) issues.push("Client date of birth is missing.");
  if (!c.client.address) issues.push("Client address is missing.");
  if (!c.policy.memberId) issues.push("Member ID is missing on the policy.");
  if (!(c.diagnosisCodes as string[]).length) issues.push("Add at least one diagnosis code.");
  for (const l of c.lines) {
    if (!/^\d{5}$|^[A-Z]\d{4}$/.test(l.cpt)) issues.push(`Line ${l.serviceDate.toISOString().slice(0, 10)}: invalid procedure code “${l.cpt}”.`);
    if (l.chargeCents <= 0) issues.push(`Line ${l.serviceDate.toISOString().slice(0, 10)}: charge must be more than zero.`);
  }
  if (c.policy.eligibility && (c.policy.eligibility as { status?: string }).status === "INACTIVE") issues.push("The last eligibility check showed coverage as inactive.");
  return issues;
}

async function pushHistory(id: string, status: string, note: string, extra: Record<string, unknown> = {}) {
  const c = await db.claim.findUniqueOrThrow({ where: { id } });
  const history = [...((c.history ?? []) as History), { at: new Date().toISOString(), status, note }];
  return db.claim.update({ where: { id }, data: { status, history, ...extra } });
}

export async function submitClaim(id: string): Promise<R> {
  const user = await requireUser();
  const issues = await claimReadiness(id);
  if (issues.length) return { error: issues[0] };
  const c = await pushHistory(id, "SUBMITTED", "Submitted to payer (simulated — no clearinghouse connected)", { submittedAt: new Date(), payerControlNumber: token(6).toUpperCase() });
  await audit(user.id, "submit", "Claim", id);
  refresh(c.clientId);
  return { ok: true };
}

/** Simulated payer response: acceptance followed by an ERA with allowed amount, payment and patient responsibility. */
export async function simulateAdjudication(id: string, outcome: "PAID" | "DENIED" | "REJECTED"): Promise<R> {
  const user = await requireUser();
  const c = await db.claim.findUniqueOrThrow({ where: { id }, include: { lines: true, policy: true } });
  if (c.status !== "SUBMITTED" && c.status !== "ACCEPTED") return { error: "Only submitted claims can be adjudicated." };
  if (outcome === "REJECTED") {
    await pushHistory(id, "REJECTED", "Rejected by clearinghouse: subscriber ID format invalid (simulated)");
    refresh(c.clientId);
    return { ok: true };
  }
  if (c.status === "SUBMITTED") await pushHistory(id, "ACCEPTED", "Accepted by payer (simulated 277CA)");
  if (outcome === "DENIED") {
    await pushHistory(id, "DENIED", "Denied: CO-50 not deemed medically necessary (simulated)", { adjudication: { reason: "CO-50", paidCents: 0 } });
    refresh(c.clientId);
    return { ok: true };
  }
  let paidTotal = 0;
  let patientTotal = 0;
  const eraLines: { claimId: string; lineId: string; paidCents: number; patientRespCents: number; adjustmentCents: number; reason: string }[] = [];
  for (const l of c.lines) {
    const allowed = Math.round(l.chargeCents * 0.8);
    const copay = c.policy.copayCents ?? 0;
    const coins = c.policy.coinsurancePct ? Math.round(((allowed - copay) * c.policy.coinsurancePct) / 100) : 0;
    const patient = Math.min(allowed, copay + coins);
    const paid = Math.max(0, allowed - patient);
    paidTotal += paid;
    patientTotal += patient;
    await db.claimLine.update({ where: { id: l.id }, data: { paidCents: paid } });
    eraLines.push({ claimId: c.id, lineId: l.id, paidCents: paid, patientRespCents: patient, adjustmentCents: l.chargeCents - allowed, reason: "CO-45 contractual adjustment" });
  }
  await db.insurancePayment.create({
    data: { payerId: c.policy.payerId, checkNumber: `EFT${token(4).toUpperCase()}`, amountCents: paidTotal, lines: eraLines },
  });
  await pushHistory(id, patientTotal > 0 && paidTotal === 0 ? "DENIED" : "PAID", `Payer paid ${money(paidTotal)}; patient responsibility ${money(patientTotal)} (simulated ERA)`, {
    paidCents: paidTotal,
    patientRespCents: patientTotal,
    adjudication: { paidCents: paidTotal, patientRespCents: patientTotal },
  });
  await audit(user.id, "adjudicate", "Claim", id, outcome);
  refresh(c.clientId);
  return { ok: true };
}

/** Bills the client for patient responsibility on a paid claim. */
export async function invoicePatientResponsibility(id: string): Promise<R> {
  await requireUser();
  const c = await db.claim.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (c.patientRespCents <= 0) return { error: "No patient responsibility on this claim." };
  const inv = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: c.clientId,
      notes: `Patient responsibility for insurance claim ${c.number}.`,
      items: { create: [{ description: `Patient responsibility — claim ${c.number}`, date: c.lines[0]?.serviceDate ?? new Date(), unitCents: c.patientRespCents }] },
    },
  });
  await refreshInvoice(inv.id);
  refresh(c.clientId);
  return { ok: true, id: inv.id };
}

export async function voidClaim(id: string): Promise<R> {
  await requireUser();
  const c = await pushHistory(id, "VOID", "Claim voided");
  refresh(c.clientId);
  return { ok: true };
}

export async function correctedClaim(id: string): Promise<R> {
  await requireUser();
  const c = await db.claim.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  const copy = await db.claim.create({
    data: {
      number: await nextClaimNumber(),
      clientId: c.clientId,
      policyId: c.policyId,
      billingProfileId: c.billingProfileId,
      diagnosisCodes: c.diagnosisCodes ?? [],
      totalCents: c.totalCents,
      history: [{ at: new Date().toISOString(), status: "DRAFT", note: `Corrected claim for ${c.number}` }],
      lines: { create: c.lines.map((l) => ({ sessionId: l.sessionId, serviceDate: l.serviceDate, cpt: l.cpt, modifiers: l.modifiers, pos: l.pos, units: l.units, chargeCents: l.chargeCents, dxPointers: l.dxPointers })) },
    },
  });
  refresh(c.clientId);
  return { ok: true, id: copy.id };
}

export async function deleteClaim(id: string): Promise<R> {
  await requireUser();
  const c = await db.claim.findUniqueOrThrow({ where: { id } });
  if (c.status !== "DRAFT") return { error: "Only drafts can be deleted. Void submitted claims instead." };
  await db.claim.delete({ where: { id } });
  refresh(c.clientId);
  return { ok: true };
}

export async function recordManualEra(data: { payerId: string; checkNumber?: string; receivedAt: string; lines: { claimId: string; paidCents: number; patientRespCents: number }[] }): Promise<R> {
  const user = await requireUser();
  const lines = data.lines.filter((l) => l.paidCents > 0 || l.patientRespCents > 0);
  if (!lines.length) return { error: "Enter at least one claim payment." };
  await db.insurancePayment.create({
    data: {
      payerId: data.payerId,
      checkNumber: data.checkNumber || null,
      receivedAt: new Date(data.receivedAt),
      amountCents: lines.reduce((n, l) => n + l.paidCents, 0),
      lines: lines.map((l) => ({ ...l, adjustmentCents: 0, reason: "Manual posting" })),
    },
  });
  for (const l of lines) {
    const c = await db.claim.findUniqueOrThrow({ where: { id: l.claimId } });
    const paid = c.paidCents + l.paidCents;
    await pushHistory(l.claimId, paid >= c.totalCents ? "PAID" : "PARTIAL", `Payment posted: ${money(l.paidCents)}`, { paidCents: paid, patientRespCents: c.patientRespCents + l.patientRespCents });
  }
  await audit(user.id, "post", "InsurancePayment");
  refresh();
  return { ok: true };
}
