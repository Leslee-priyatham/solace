import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Invoice", robots: { index: false } };

export default async function PortalInvoice({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const inv = await db.invoice.findFirst({
    where: { id, client: { portalToken: token }, status: { not: "DRAFT" } },
    include: { client: true, items: { orderBy: { date: "asc" } }, allocations: { include: { payment: true } } },
  });
  if (!inv) notFound();
  const practice = await db.practice.findFirst();
  const instructions = ((practice?.settings ?? {}) as { billing?: { paymentInstructions?: string } }).billing?.paymentInstructions;
  return (
    <div className="min-h-screen bg-canvas py-8">
      <div className="no-print mx-auto mb-4 flex max-w-4xl items-center justify-between px-4">
        <Link href={`/portal/${token}`} className="text-sm font-medium text-brand-700">
          ← Back to portal
        </Link>
        <PrintButton />
      </div>
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line">
        <InvoiceDocument practice={practice} inv={{ ...inv, payments: inv.allocations.map((a) => ({ id: a.id, date: a.payment.receivedAt, method: a.payment.method, amountCents: a.amountCents })) }} />
      </div>
      {instructions && inv.totalCents > inv.paidCents && (
        <div className="no-print mx-auto mt-4 max-w-4xl rounded-2xl border border-line bg-white p-6 text-sm">
          <div className="font-semibold">How to pay</div>
          <p className="mt-1 whitespace-pre-line text-muted">{instructions}</p>
        </div>
      )}
    </div>
  );
}
