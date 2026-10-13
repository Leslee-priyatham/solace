import "server-only";
import { db } from "./db";

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await db.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function nextSuperbillNumber() {
  const count = await db.superbill.count();
  return `SB-${String(count + 1).padStart(5, "0")}`;
}

export async function nextClaimNumber() {
  const count = await db.claim.count();
  return `CLM-${String(count + 1).padStart(6, "0")}`;
}

/** Recomputes an invoice's paid amount and status from its allocations. */
export async function refreshInvoice(invoiceId: string) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { allocations: true, items: true } });
  const total = inv.items.reduce((n, i) => n + i.unitCents * i.quantity, 0);
  const paid = inv.allocations.reduce((n, a) => n + a.amountCents, 0);
  // Void and written-off are terminal; otherwise status follows payments, then whether it was sent.
  const status =
    inv.status === "VOID" || inv.status === "WRITTEN_OFF"
      ? inv.status
      : total > 0 && paid >= total
        ? "PAID"
        : paid > 0
          ? "PARTIAL"
          : inv.sentAt
            ? "SENT"
            : "DRAFT";
  await db.invoice.update({ where: { id: invoiceId }, data: { totalCents: total, paidCents: paid, status } });
}

/** Client balance: open invoice totals minus payments not yet allocated. */
export async function clientBalance(clientId: string) {
  const [invoices, payments] = await Promise.all([
    db.invoice.findMany({ where: { clientId, status: { in: ["SENT", "PARTIAL", "DRAFT"] } } }),
    db.payment.findMany({ where: { clientId }, include: { allocations: true } }),
  ]);
  const owed = invoices.filter((i) => i.status !== "DRAFT").reduce((n, i) => n + i.totalCents - i.paidCents, 0);
  const unallocated = payments.reduce((n, p) => n + p.amountCents - p.refundedCents - p.allocations.reduce((m, a) => m + a.amountCents, 0), 0);
  return { owed, credit: Math.max(0, unallocated), net: owed - Math.max(0, unallocated) };
}
