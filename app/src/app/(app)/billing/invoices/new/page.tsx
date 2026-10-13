import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InvoiceEditor } from "../invoice-editor";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string; session?: string }> }) {
  const { client, session } = await searchParams;
  const clients = await db.client.findMany({ where: { status: { not: "DISCHARGED" } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } });
  const services = await db.service.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Payments", href: "/billing" }, { label: "New invoice" }]} title="New invoice" />
      <InvoiceEditor
        clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
        services={services.map((s) => ({ id: s.id, name: s.name, cpt: s.cpt, rateCents: s.rateCents }))}
        initialClientId={client}
        preselectSessionId={session}
      />
    </>
  );
}
