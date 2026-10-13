import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, Td, Th } from "@/components/ui";
import { date, money } from "@/lib/format";
import { ManualEra } from "./manual-era";

export const metadata = { title: "Payer payments" };

export default async function PayerPaymentsPage() {
  const [payments, payers, openClaims] = await Promise.all([
    db.insurancePayment.findMany({ include: { payer: true }, orderBy: { receivedAt: "desc" } }),
    db.payer.findMany({ orderBy: { name: "asc" } }),
    db.claim.findMany({ where: { status: { in: ["SUBMITTED", "ACCEPTED", "PARTIAL"] } }, include: { client: true, policy: { include: { payer: true } } } }),
  ]);
  const claimNumbers = Object.fromEntries((await db.claim.findMany({ select: { id: true, number: true } })).map((c) => [c.id, c.number]));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ManualEra
          payers={payers.map((p) => ({ id: p.id, name: p.name }))}
          claims={openClaims.map((c) => ({ id: c.id, label: `${c.number} · ${c.client.firstName} ${c.client.lastName} · ${money(c.totalCents - c.paidCents)} open`, payerId: c.policy.payerId }))}
        />
      </div>
      {payments.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">No payer payments yet. They appear here when ERAs are received or posted manually.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Received</Th>
              <Th>Payer</Th>
              <Th>Check / EFT</Th>
              <Th>Claims</Th>
              <Th className="text-right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const lines = p.lines as { claimId: string; paidCents: number }[];
              return (
                <tr key={p.id}>
                  <Td className="text-muted">{date(p.receivedAt)}</Td>
                  <Td>{p.payer.name}</Td>
                  <Td className="text-muted">{p.checkNumber ?? "—"}</Td>
                  <Td>
                    {[...new Set(lines.map((l) => l.claimId))].map((id) => (
                      <Link key={id} href={`/insurance/claims/${id}`} className="mr-2 text-brand-700">
                        {claimNumbers[id] ?? "claim"}
                      </Link>
                    ))}
                  </Td>
                  <Td className="text-right tabular-nums">{money(p.amountCents)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
