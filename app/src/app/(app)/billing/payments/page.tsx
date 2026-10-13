import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Table, Td, Th } from "@/components/ui";
import { PAYMENT_METHOD } from "@/lib/constants";
import { date, money } from "@/lib/format";
import { PaymentRowActions } from "./payment-row-actions";

export const metadata = { title: "Transactions" };

export default async function PaymentsPage() {
  const payments = await db.payment.findMany({ include: { client: true, allocations: { include: { invoice: { select: { id: true, number: true } } } } }, orderBy: { receivedAt: "desc" }, take: 300 });
  if (!payments.length) return <Card className="p-10 text-center text-sm text-muted">No payments recorded yet.</Card>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Client</Th>
          <Th>Method</Th>
          <Th>Applied to</Th>
          <Th className="text-right">Amount</Th>
          <Th className="text-right">Unapplied</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => {
          const applied = p.allocations.reduce((n, a) => n + a.amountCents, 0);
          const unapplied = p.amountCents - p.refundedCents - applied;
          return (
            <tr key={p.id}>
              <Td className="text-muted">{date(p.receivedAt)}</Td>
              <Td>
                <Link href={`/clients/${p.clientId}/billing`} className="font-medium hover:text-brand-700">
                  {p.client.firstName} {p.client.lastName}
                </Link>
              </Td>
              <Td>
                {PAYMENT_METHOD[p.method as keyof typeof PAYMENT_METHOD]}
                {p.reference && <span className="text-xs text-muted"> · {p.reference}</span>}
              </Td>
              <Td className="text-sm">
                {p.allocations.length
                  ? p.allocations.map((a) => (
                      <Link key={a.id} href={`/billing/invoices/${a.invoice.id}`} className="mr-2 text-brand-700">
                        {a.invoice.number}
                      </Link>
                    ))
                  : "—"}
              </Td>
              <Td className="text-right tabular-nums">
                {money(p.amountCents)}
                {p.refundedCents > 0 && (
                  <Badge color="amber" className="ml-2">
                    −{money(p.refundedCents)} refunded
                  </Badge>
                )}
              </Td>
              <Td className="text-right tabular-nums text-muted">{unapplied > 0 ? money(unapplied) : "—"}</Td>
              <Td className="text-right">
                <PaymentRowActions id={p.id} refundable={p.amountCents - p.refundedCents} />
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
