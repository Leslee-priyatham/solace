import Link from "next/link";
import { Plus, Banknote } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, CardHeader, Stat, Table, Td, statusColor } from "@/components/ui";
import { INVOICE_STATUS, PAYMENT_METHOD } from "@/lib/constants";
import { clientBalance } from "@/lib/billing";
import { date, money } from "@/lib/format";
import { NewSuperbill } from "@/app/(app)/billing/superbills/new-superbill";
import { PoliciesCard } from "./policies-card";

export default async function ClientBillingTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoices, payments, superbills, balance, policies, payers, auths, claims] = await Promise.all([
    db.invoice.findMany({ where: { clientId: id }, orderBy: { issueDate: "desc" } }),
    db.payment.findMany({ where: { clientId: id }, orderBy: { receivedAt: "desc" } }),
    db.superbill.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" } }),
    clientBalance(id),
    db.insurancePolicy.findMany({ where: { clientId: id, archived: false }, include: { payer: true }, orderBy: { priority: "asc" } }),
    db.payer.findMany({ orderBy: { name: "asc" } }),
    db.priorAuthorization.findMany({ where: { clientId: id, archived: false }, orderBy: { startDate: "desc" } }),
    db.claim.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Balance owed" value={money(balance.owed)} />
        <Stat label="Unapplied credit" value={money(balance.credit)} />
        <Stat label="Lifetime paid" value={money(payments.reduce((n, p) => n + p.amountCents - p.refundedCents, 0))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/billing/invoices/new?client=${id}`}>
          <Plus className="size-4" /> New invoice
        </ButtonLink>
        <ButtonLink href={`/billing/payments/new?client=${id}`} variant="outline">
          <Banknote className="size-4" /> Record payment
        </ButtonLink>
        <NewSuperbill clients={[]} clientId={id} />
        <ButtonLink href={`/billing/statements?client=${id}`} variant="outline">
          Statement
        </ButtonLink>
      </div>

      <Card>
        <CardHeader title="Invoices" />
        {invoices.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No invoices yet.</p>
        ) : (
          <Table className="rounded-none border-0">
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <Td>
                    <Link href={`/billing/invoices/${i.id}`} className="font-medium hover:text-brand-700">
                      {i.number}
                    </Link>
                  </Td>
                  <Td className="text-muted">{date(i.issueDate)}</Td>
                  <Td className="text-right tabular-nums">{money(i.totalCents)}</Td>
                  <Td className="text-right tabular-nums text-muted">{money(i.totalCents - i.paidCents)} due</Td>
                  <Td>
                    <Badge color={statusColor(i.status)}>{INVOICE_STATUS[i.status as keyof typeof INVOICE_STATUS]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Payments" />
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No payments yet.</p>
        ) : (
          <Table className="rounded-none border-0">
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="text-muted">{date(p.receivedAt)}</Td>
                  <Td>{PAYMENT_METHOD[p.method as keyof typeof PAYMENT_METHOD]}</Td>
                  <Td className="text-muted">{p.reference}</Td>
                  <Td className="text-right tabular-nums">{money(p.amountCents)}</Td>
                  <Td>{p.refundedCents > 0 && <Badge color="amber">{money(p.refundedCents)} refunded</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {superbills.length > 0 && (
        <Card>
          <CardHeader title="Superbills" />
          <ul className="divide-y divide-line">
            {superbills.map((s) => (
              <li key={s.id} className="flex justify-between px-5 py-2.5 text-sm">
                <Link href={`/billing/superbills/${s.id}`} className="font-medium hover:text-brand-700">
                  {s.number}
                </Link>
                <span className="text-muted">
                  {date(s.periodStart)} – {date(s.periodEnd)} · {money(s.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PoliciesCard
        clientId={id}
        payers={payers.map((p) => ({ id: p.id, name: p.name }))}
        policies={policies.map((p) => ({
          id: p.id,
          payerId: p.payerId,
          payer: p.payer.name,
          priority: p.priority,
          memberId: p.memberId,
          groupNumber: p.groupNumber,
          planName: p.planName,
          subscriberName: p.subscriberName,
          relationship: p.relationship,
          copayCents: p.copayCents,
          coinsurancePct: p.coinsurancePct,
          deductibleCents: p.deductibleCents,
          eligibility: p.eligibility as { checkedAt: string; status: string; summary: string } | null,
        }))}
        authorizations={auths.map((a) => ({ id: a.id, authNumber: a.authNumber, cpt: a.cpt, visitsAllowed: a.visitsAllowed, visitsUsed: a.visitsUsed, startDate: a.startDate.toISOString(), endDate: a.endDate?.toISOString() ?? null }))}
      />

      {claims.length > 0 && (
        <Card>
          <CardHeader title="Recent claims" actions={<Link href={`/insurance?client=${id}`} className="text-sm font-medium text-brand-700">All claims</Link>} />
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <Link href={`/insurance/claims/${c.id}`} className="font-medium hover:text-brand-700">
                  {c.number}
                </Link>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(c.totalCents)}</span>
                  <Badge color={statusColor(c.status)}>{c.status.toLowerCase()}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
