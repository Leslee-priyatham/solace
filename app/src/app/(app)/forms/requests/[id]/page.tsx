import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader, statusColor } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { ReadOnlyForm } from "./read-only-form";
import type { Answers, FormField } from "@/lib/forms";
import { severity } from "@/lib/library";

export const metadata = { title: "Form response" };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.formRequest.findUnique({ where: { id }, include: { client: true, form: true } });
  if (!r) notFound();
  const name = `${r.client.firstName} ${r.client.lastName}`;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: name, href: `/clients/${r.clientId}/forms` }, { label: r.form.name }]}
        title={r.form.name}
        description={`Sent ${dateTime(r.sentAt)}${r.completedAt ? ` · completed ${dateTime(r.completedAt)}` : ""}`}
        actions={<Badge color={statusColor(r.status)}>{r.status.replace("_", " ").toLowerCase()}</Badge>}
      />
      {r.score !== null && r.form.measure && (
        <Card className="mb-4 flex items-center gap-4 p-5">
          <div className="text-3xl font-semibold">{r.score}</div>
          <div>
            <div className="font-medium">{r.form.measure === "PHQ9" ? "PHQ-9" : "GAD-7"} total</div>
            <div className="text-sm text-muted">{severity(r.form.measure, r.score)} range</div>
          </div>
        </Card>
      )}
      <Card className="max-w-3xl p-6">
        <ReadOnlyForm fields={r.form.fields as unknown as FormField[]} answers={r.answers as unknown as Answers} />
        {r.signatureName && <p className="mt-6 border-t border-line pt-4 text-sm text-muted">Signed electronically as “{r.signatureName}” on {dateTime(r.completedAt)}</p>}
      </Card>
    </>
  );
}
