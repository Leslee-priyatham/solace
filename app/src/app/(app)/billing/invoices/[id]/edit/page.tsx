import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceEditor } from "../../invoice-editor";

export const metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { items: true, client: true } });
  if (!inv) notFound();
  if (inv.status !== "DRAFT") redirect(`/billing/invoices/${id}`);
  const services = await db.service.findMany({ where: { archived: false } });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Payments", href: "/billing" }, { label: `Invoice ${inv.number}`, href: `/billing/invoices/${id}` }, { label: "Edit" }]} title={`Edit ${inv.number}`} />
      <InvoiceEditor
        clients={[{ id: inv.clientId, name: `${inv.client.firstName} ${inv.client.lastName}` }]}
        services={services.map((s) => ({ id: s.id, name: s.name, cpt: s.cpt, rateCents: s.rateCents }))}
        existing={{
          id: inv.id,
          clientId: inv.clientId,
          issueDate: inv.issueDate.toISOString(),
          dueDate: inv.dueDate?.toISOString() ?? null,
          notes: inv.notes,
          lines: inv.items.map((i) => ({ description: i.description, cpt: i.cpt ?? "", date: i.date.toISOString().slice(0, 10), quantity: i.quantity, unit: (i.unitCents / 100).toFixed(2), sessionId: i.sessionId })),
        }}
      />
    </>
  );
}
