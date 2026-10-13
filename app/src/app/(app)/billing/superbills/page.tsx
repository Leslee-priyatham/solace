import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, Td, Th } from "@/components/ui";
import { date, money } from "@/lib/format";
import { NewSuperbill } from "./new-superbill";

export const metadata = { title: "Superbills" };

export default async function SuperbillsPage() {
  const [superbills, clients] = await Promise.all([
    db.superbill.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h3 className="font-semibold">Superbills</h3>
          <p className="text-sm text-muted">Itemised statements with diagnosis and service codes that clients submit for out-of-network reimbursement.</p>
        </div>
        <NewSuperbill clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))} />
      </Card>
      {superbills.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Number</Th>
              <Th>Client</Th>
              <Th>Period</Th>
              <Th>Sessions</Th>
              <Th className="text-right">Total</Th>
              <Th>Sent</Th>
            </tr>
          </thead>
          <tbody>
            {superbills.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/billing/superbills/${s.id}`} className="font-medium hover:text-brand-700">
                    {s.number}
                  </Link>
                </Td>
                <Td>
                  {s.client.firstName} {s.client.lastName}
                </Td>
                <Td className="text-muted">
                  {date(s.periodStart)} – {date(s.periodEnd)}
                </Td>
                <Td>{(s.sessionIds as string[]).length}</Td>
                <Td className="text-right tabular-nums">{money(s.totalCents)}</Td>
                <Td className="text-muted">{s.sentAt ? date(s.sentAt) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
