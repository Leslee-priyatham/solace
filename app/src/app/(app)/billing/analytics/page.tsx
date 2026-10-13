import { subMonths, startOfMonth, format, differenceInDays } from "date-fns";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, Stat } from "@/components/ui";
import { money } from "@/lib/format";
import { PAYMENT_METHOD } from "@/lib/constants";
import { BarChartCard } from "@/components/charts";

export const metadata = { title: "Billing analytics" };

export default async function BillingAnalyticsPage() {
  const since = startOfMonth(subMonths(new Date(), 11));
  const [payments, invoices, open] = await Promise.all([
    db.payment.findMany({ where: { receivedAt: { gte: since } } }),
    db.invoice.findMany({ where: { issueDate: { gte: since }, status: { notIn: ["DRAFT", "VOID"] } } }),
    db.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL"] } }, include: { client: true } }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(subMonths(new Date(), 11 - i)));
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM");
    return {
      label: format(m, "MMM"),
      Invoiced: invoices.filter((i) => format(i.issueDate, "yyyy-MM") === key).reduce((n, i) => n + i.totalCents, 0) / 100,
      Collected: payments.filter((p) => format(p.receivedAt, "yyyy-MM") === key).reduce((n, p) => n + p.amountCents - p.refundedCents, 0) / 100,
    };
  });

  const buckets = [
    { label: "Current", min: -Infinity, max: 0 },
    { label: "1–30 days", min: 1, max: 30 },
    { label: "31–60 days", min: 31, max: 60 },
    { label: "61–90 days", min: 61, max: 90 },
    { label: "90+ days", min: 91, max: Infinity },
  ].map((b) => ({
    label: b.label,
    Outstanding:
      open
        .filter((i) => {
          const overdue = i.dueDate ? differenceInDays(new Date(), i.dueDate) : 0;
          return overdue >= b.min && overdue <= b.max;
        })
        .reduce((n, i) => n + i.totalCents - i.paidCents, 0) / 100,
  }));

  const byMethod = Object.entries(
    payments.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.method]: (acc[p.method] ?? 0) + p.amountCents - p.refundedCents }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const byClient = Object.values(
    open.reduce<Record<string, { id: string; name: string; due: number }>>((acc, i) => {
      const cur = acc[i.clientId] ?? { id: i.clientId, name: `${i.client.firstName} ${i.client.lastName}`, due: 0 };
      cur.due += i.totalCents - i.paidCents;
      return { ...acc, [i.clientId]: cur };
    }, {}),
  )
    .sort((a, b) => b.due - a.due)
    .slice(0, 8);

  const collected12 = monthly.reduce((n, m) => n + m.Collected, 0) * 100;
  const invoiced12 = monthly.reduce((n, m) => n + m.Invoiced, 0) * 100;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Collected (12 months)" value={money(collected12)} />
        <Stat label="Invoiced (12 months)" value={money(invoiced12)} />
        <Stat label="Collection rate" value={invoiced12 ? `${Math.round((collected12 / invoiced12) * 100)}%` : "—"} />
      </div>
      <BarChartCard title="Invoiced vs collected" description="Last 12 months" data={monthly} keys={["Invoiced", "Collected"]} currency />
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard title="Outstanding by age" description="Days past due" data={buckets} keys={["Outstanding"]} currency />
        <Card>
          <CardHeader title="Largest balances" />
          <ul className="divide-y divide-line">
            {byClient.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">No outstanding balances.</li>}
            {byClient.map((c) => (
              <li key={c.id} className="flex justify-between px-5 py-2.5 text-sm">
                <Link href={`/clients/${c.id}/billing`} className="font-medium hover:text-brand-700">
                  {c.name}
                </Link>
                <span className="tabular-nums">{money(c.due)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Payments by method" description="Last 12 months" />
        <ul className="divide-y divide-line">
          {byMethod.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">No payments yet.</li>}
          {byMethod.map(([m, cents]) => (
            <li key={m} className="flex justify-between px-5 py-2.5 text-sm">
              <span>{PAYMENT_METHOD[m as keyof typeof PAYMENT_METHOD] ?? m}</span>
              <span className="tabular-nums">{money(cents)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
