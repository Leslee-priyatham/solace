import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader, statusColor } from "@/components/ui";
import { InvoiceDocument } from "@/components/invoice-document";
import { INVOICE_STATUS } from "@/lib/constants";
import { InvoiceActions } from "./invoice-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, select: { number: true } });
  return { title: inv ? `Invoice ${inv.number}` : "Invoice" };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { client: true, items: { orderBy: { date: "asc" } }, allocations: { include: { payment: true } } },
  });
  if (!inv) notFound();
  const practice = await db.practice.findFirst();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payments", href: "/billing" }, { label: `Invoice ${inv.number}` }]}
        title={
          <span className="flex items-center gap-3">
            Invoice {inv.number} <Badge color={statusColor(inv.status)}>{INVOICE_STATUS[inv.status as keyof typeof INVOICE_STATUS]}</Badge>
          </span>
        }
        description={`${inv.client.firstName} ${inv.client.lastName}${inv.sentAt ? ` · sent ${inv.sentAt.toLocaleDateString()}` : ""}`}
        actions={<InvoiceActions id={inv.id} clientId={inv.clientId} status={inv.status} balanceCents={inv.totalCents - inv.paidCents} sent={!!inv.sentAt} />}
      />
      <Card className="mx-auto max-w-4xl overflow-hidden">
        <InvoiceDocument
          practice={practice}
          inv={{
            ...inv,
            payments: inv.allocations.map((a) => ({ id: a.id, date: a.payment.receivedAt, method: a.payment.method, amountCents: a.amountCents })),
          }}
        />
      </Card>
    </>
  );
}
