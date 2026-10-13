import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { SuperbillDocument } from "@/components/superbill-document";
import { SuperbillActions } from "./superbill-actions";

export const metadata = { title: "Superbill" };

export default async function SuperbillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await db.superbill.findUnique({ where: { id }, include: { client: { include: { diagnoses: { orderBy: { sortOrder: "asc" } } } } } });
  if (!sb) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Payments", href: "/billing" }, { label: "Superbills", href: "/billing/superbills" }, { label: sb.number }]}
        title={`Superbill ${sb.number}`}
        actions={<SuperbillActions id={sb.id} sent={!!sb.sentAt} />}
      />
      <Card className="mx-auto max-w-4xl overflow-hidden">
        <SuperbillDocument superbillId={sb.id} />
      </Card>
    </>
  );
}
