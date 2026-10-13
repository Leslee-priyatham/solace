import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, PageHeader, Table, Td, Th, statusColor, Card } from "@/components/ui";
import { date } from "@/lib/format";
import { FormsTabs } from "../forms-tabs";

export const metadata = { title: "Form requests" };

export default async function RequestsPage() {
  const requests = await db.formRequest.findMany({ include: { client: true, form: true }, orderBy: { sentAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Practice forms" />
      <FormsTabs />
      {requests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">No forms have been sent yet.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Form</Th>
              <Th>Sent</Th>
              <Th>Completed</Th>
              <Th>Score</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-canvas/60">
                <Td>
                  <Link href={`/clients/${r.clientId}/forms`} className="font-medium hover:text-brand-700">
                    {r.client.firstName} {r.client.lastName}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/forms/requests/${r.id}`} className="hover:text-brand-700">
                    {r.form.name}
                  </Link>
                </Td>
                <Td className="text-muted">{date(r.sentAt)}</Td>
                <Td className="text-muted">{r.completedAt ? date(r.completedAt) : "—"}</Td>
                <Td>{r.score ?? "—"}</Td>
                <Td>
                  <Badge color={statusColor(r.status)}>{r.status.replace("_", " ").toLowerCase()}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
