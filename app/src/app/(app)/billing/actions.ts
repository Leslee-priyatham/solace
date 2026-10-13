"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { nextInvoiceNumber, nextSuperbillNumber, refreshInvoice } from "@/lib/billing";
import { money } from "@/lib/format";

type R = { error?: string; ok?: boolean; id?: string };
type Line = { description: string; cpt?: string | null; date: string; quantity: number; unitCents: number; sessionId?: string | null };

function revalidateBilling(clientId?: string) {
  revalidatePath("/billing", "layout");
  if (clientId) revalidatePath(`/clients/${clientId}/billing`);
}

async function messageClient(clientId: string, author: string, body: string) {
  let conv = await db.conversation.findFirst({ where: { clientId, archived: false } });
  if (!conv) conv = await db.conversation.create({ data: { clientId } });
  await db.message.create({ data: { conversationId: conv.id, sender: "PROVIDER", authorName: author, body } });
  await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
}

export async function createInvoice(data: { clientId: string; issueDate: string; dueDate?: string; notes?: string; lines: Line[]; send?: boolean }): Promise<R> {
  const user = await requireUser();
  if (!data.clientId) return { error: "Choose a client." };
  const lines = data.lines.filter((l) => l.description.trim() && l.quantity > 0);
  if (!lines.length) return { error: "Add at least one line item." };
  const p = await db.practice.findFirst();
  const dueDays = ((p?.settings ?? {}) as { billing?: { invoiceDueDays?: number } }).billing?.invoiceDueDays ?? 14;
  const issue = new Date(data.issueDate);
  const inv = await db.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: data.clientId,
      issueDate: issue,
      dueDate: data.dueDate ? new Date(data.dueDate) : addDays(issue, dueDays),
      notes: data.notes || null,
      items: {
        create: lines.map((l) => ({ description: l.description.trim(), cpt: l.cpt || null, date: new Date(l.date), quantity: l.quantity, unitCents: l.unitCents, sessionId: l.sessionId || null })),
      },
    },
  });
  await refreshInvoice(inv.id);
  await audit(user.id, "create", "Invoice", inv.id, inv.number);
  // Apply any unallocated client credit automatically.
  await applyCredit(data.clientId);
  if (data.send) await sendInvoice(inv.id);
  revalidateBilling(data.clientId);
  return { ok: true, id: inv.id };
}

export async function updateInvoiceLines(id: string, data: { issueDate: string; dueDate?: string; notes?: string; lines: Line[] }): Promise<R> {
  await requireUser();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
  if (inv.status !== "DRAFT") return { error: "Only draft invoices can be edited." };
  await db.invoiceItem.deleteMany({ where: { invoiceId: id } });
  await db.invoice.update({
    where: { id },
    data: {
      issueDate: new Date(data.issueDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes || null,
      items: { create: data.lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description, cpt: l.cpt || null, date: new Date(l.date), quantity: l.quantity, unitCents: l.unitCents, sessionId: l.sessionId || null })) },
    },
  });
  await refreshInvoice(id);
  revalidateBilling(inv.clientId);
  return { ok: true };
}

export async function sendInvoice(id: string): Promise<R> {
  const user = await requireUser();
  const inv = await db.invoice.update({ where: { id }, data: { sentAt: new Date() } });
  await refreshInvoice(id);
  await messageClient(
    inv.clientId,
    `${user.firstName} ${user.lastName}`,
    `Invoice ${inv.number} for ${money(inv.totalCents - inv.paidCents)} is ready. You can view it in the Billing section of your client portal.`,
  );
  await audit(user.id, "send", "Invoice", id);
  revalidateBilling(inv.clientId);
  return { ok: true };
}

export async function setInvoiceStatus(id: string, status: "VOID" | "WRITTEN_OFF" | "OPEN"): Promise<R> {
  const user = await requireUser();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id }, include: { allocations: true } });
  if (status === "VOID" && inv.allocations.length) return { error: "Remove the payments applied to this invoice before voiding it." };
  await db.invoice.update({ where: { id }, data: { status: status === "OPEN" ? "SENT" : status } });
  if (status === "OPEN") await refreshInvoice(id);
  await audit(user.id, "status", "Invoice", id, status);
  revalidateBilling(inv.clientId);
  return { ok: true };
}

export async function deleteInvoice(id: string) {
  const user = await requireUser();
  const inv = await db.invoice.findUniqueOrThrow({ where: { id } });
  if (inv.status !== "DRAFT") return { error: "Only drafts can be deleted. Void sent invoices instead." };
  await db.invoice.delete({ where: { id } });
  await audit(user.id, "delete", "Invoice", id);
  revalidateBilling(inv.clientId);
  redirect("/billing");
}

/** Records a payment and allocates it to open invoices (a chosen one first, then oldest first). */
export async function recordPayment(data: { clientId: string; amountCents: number; method: string; receivedAt: string; reference?: string; notes?: string; invoiceId?: string }): Promise<R> {
  const user = await requireUser();
  if (!data.clientId) return { error: "Choose a client." };
  if (!(data.amountCents > 0)) return { error: "Enter an amount greater than zero." };
  const payment = await db.payment.create({
    data: {
      clientId: data.clientId,
      amountCents: data.amountCents,
      method: data.method,
      receivedAt: new Date(data.receivedAt),
      reference: data.reference || null,
      notes: data.notes || null,
    },
  });
  await allocate(payment.id, data.invoiceId);
  await audit(user.id, "create", "Payment", payment.id, money(data.amountCents));
  revalidateBilling(data.clientId);
  return { ok: true, id: payment.id };
}

async function allocate(paymentId: string, preferredInvoiceId?: string) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { allocations: true } });
  let remaining = p.amountCents - p.refundedCents - p.allocations.reduce((n, a) => n + a.amountCents, 0);
  if (remaining <= 0) return;
  const open = await db.invoice.findMany({ where: { clientId: p.clientId, status: { in: ["SENT", "PARTIAL", "DRAFT"] } }, orderBy: { issueDate: "asc" } });
  open.sort((a, b) => (a.id === preferredInvoiceId ? -1 : b.id === preferredInvoiceId ? 1 : 0));
  for (const inv of open) {
    if (remaining <= 0) break;
    const due = inv.totalCents - inv.paidCents;
    if (due <= 0) continue;
    const amt = Math.min(due, remaining);
    await db.paymentAllocation.create({ data: { paymentId, invoiceId: inv.id, amountCents: amt } });
    remaining -= amt;
    await refreshInvoice(inv.id);
  }
}

async function applyCredit(clientId: string) {
  const payments = await db.payment.findMany({ where: { clientId }, include: { allocations: true }, orderBy: { receivedAt: "asc" } });
  for (const p of payments) await allocate(p.id);
}

export async function refundPayment(id: string, amountCents: number): Promise<R> {
  const user = await requireUser();
  const p = await db.payment.findUniqueOrThrow({ where: { id }, include: { allocations: true } });
  const refundable = p.amountCents - p.refundedCents;
  if (amountCents <= 0 || amountCents > refundable) return { error: `You can refund up to ${money(refundable)}.` };
  // Unwind allocations newest-first until the refund is covered.
  let toFree = Math.max(0, amountCents - (refundable - p.allocations.reduce((n, a) => n + a.amountCents, 0)));
  for (const a of [...p.allocations].reverse()) {
    if (toFree <= 0) break;
    const take = Math.min(a.amountCents, toFree);
    if (take === a.amountCents) await db.paymentAllocation.delete({ where: { id: a.id } });
    else await db.paymentAllocation.update({ where: { id: a.id }, data: { amountCents: a.amountCents - take } });
    toFree -= take;
    await refreshInvoice(a.invoiceId);
  }
  await db.payment.update({ where: { id }, data: { refundedCents: p.refundedCents + amountCents } });
  await audit(user.id, "refund", "Payment", id, money(amountCents));
  revalidateBilling(p.clientId);
  return { ok: true };
}

export async function deletePayment(id: string): Promise<R> {
  const user = await requireUser();
  const p = await db.payment.findUniqueOrThrow({ where: { id }, include: { allocations: true } });
  await db.payment.delete({ where: { id } });
  for (const a of p.allocations) await refreshInvoice(a.invoiceId);
  await audit(user.id, "delete", "Payment", id);
  revalidateBilling(p.clientId);
  return { ok: true };
}

export async function createSuperbill(data: { clientId: string; from: string; to: string }): Promise<R> {
  const user = await requireUser();
  const sessions = await db.session.findMany({
    where: { clientId: data.clientId, startedAt: { gte: new Date(data.from), lte: new Date(`${data.to}T23:59:59`) }, billingType: { not: "NONE" } },
    orderBy: { startedAt: "asc" },
  });
  if (!sessions.length) return { error: "No billable sessions in that date range." };
  const sb = await db.superbill.create({
    data: {
      number: await nextSuperbillNumber(),
      clientId: data.clientId,
      periodStart: new Date(data.from),
      periodEnd: new Date(data.to),
      sessionIds: sessions.map((s) => s.id),
      totalCents: sessions.reduce((n, s) => n + (s.feeCents ?? 0), 0),
    },
  });
  await audit(user.id, "create", "Superbill", sb.id);
  revalidateBilling(data.clientId);
  return { ok: true, id: sb.id };
}

export async function sendSuperbill(id: string): Promise<R> {
  const user = await requireUser();
  const sb = await db.superbill.update({ where: { id }, data: { sentAt: new Date() } });
  await messageClient(sb.clientId, `${user.firstName} ${user.lastName}`, `Your superbill ${sb.number} is ready for insurance reimbursement. Find it in the Billing section of your portal.`);
  revalidateBilling(sb.clientId);
  return { ok: true };
}

export async function deleteSuperbill(id: string): Promise<R> {
  await requireUser();
  const sb = await db.superbill.delete({ where: { id } });
  revalidateBilling(sb.clientId);
  return { ok: true };
}

/** Creates one draft invoice per client from uninvoiced self-pay sessions. */
export async function invoiceUnbilled(sessionIds: string[], send: boolean): Promise<R> {
  await requireUser();
  const sessions = await db.session.findMany({ where: { id: { in: sessionIds }, invoiceItems: { none: {} } }, include: { appointment: { include: { service: true } } } });
  const byClient = new Map<string, typeof sessions>();
  for (const s of sessions) if (s.clientId) byClient.set(s.clientId, [...(byClient.get(s.clientId) ?? []), s]);
  for (const [clientId, list] of byClient) {
    await createInvoice({
      clientId,
      issueDate: new Date().toISOString(),
      send,
      lines: list.map((s) => ({
        description: s.appointment?.service?.name ?? "Psychotherapy session",
        cpt: s.cpt,
        date: s.startedAt.toISOString(),
        quantity: 1,
        unitCents: s.feeCents ?? s.appointment?.service?.rateCents ?? 0,
        sessionId: s.id,
      })),
    });
  }
  return { ok: true };
}
