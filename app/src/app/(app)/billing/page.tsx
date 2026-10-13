import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, EmptyState, Input, Stat, Table, Td, Th, cn, statusColor } from "@/components/ui";
import { INVOICE_STATUS } from "@/lib/constants";
import { date, money } from "@/lib/format";

export const metadata = { title: "Invoices" };

const FILTERS = [
  ["open", "Open"],
  ["overdue", "Overdue"],
  ["DRAFT", "Drafts"],
  ["PAID", "Paid"],
  ["all", "All"],
] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "open", q } = await searchParams;
  const where: Prisma.InvoiceWhereInput = {};
  if (status === "open") where.status = { in: ["SENT", "PARTIAL"] };
  else if (status === "overdue") Object.assign(where, { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: new Date() } });
  else if (status !== "all") where.status = status;
  if (q) where.OR = [{ number: { contains: q } }, { client: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } }];

  const [invoices, openAgg, overdueAgg, monthPaid, total] = await Promise.all([
    db.invoice.findMany({ where, include: { client: true }, orderBy: { issueDate: "desc" }, take: 200 }),
    db.invoice.aggregate({ _sum: { totalCents: true, paidCents: true }, where: { status: { in: ["SENT", "PARTIAL"] } } }),
    db.invoice.aggregate({ _sum: { totalCents: true, paidCents: true }, _count: true, where: { status: { in: ["SENT", "PARTIAL"] }, dueDate: { lt: new Date() } } }),
    db.payment.aggregate({ _sum: { amountCents: true, refundedCents: true }, where: { receivedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    db.invoice.count(),
  ]);
  const outstanding = (openAgg._sum.totalCents ?? 0) - (openAgg._sum.paidCents ?? 0);
  const overdue = (overdueAgg._sum.totalCents ?? 0) - (overdueAgg._sum.paidCents ?? 0);

  if (total === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="Get paid for your sessions"
          description="Create invoices from sessions, record card, cash or bank payments, and give clients superbills for out-of-network reimbursement."
          action={
            <div className="flex gap-2">
              <ButtonLink href="/billing/unbilled" variant="outline">
                Invoice unbilled sessions
              </ButtonLink>
              <ButtonLink href="/billing/invoices/new">Create an invoice</ButtonLink>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat label="Overdue" value={money(overdue)} hint={`${overdueAgg._count} invoice${overdueAgg._count === 1 ? "" : "s"}`} />
        <Stat label="Collected this month" value={money((monthPaid._sum.amountCents ?? 0) - (monthPaid._sum.refundedCents ?? 0))} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
          {FILTERS.map(([k, l]) => (
            <Link key={k} href={`/billing?status=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", status === k ? "bg-brand-50 text-brand-800" : "text-muted")}>
              {l}
            </Link>
          ))}
        </div>
        <form>
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={q} placeholder="Search invoice # or client" className="w-64" />
        </form>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Invoice</Th>
            <Th>Client</Th>
            <Th>Issued</Th>
            <Th>Due</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">Balance</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-10 text-center text-muted">
                No invoices here.
              </Td>
            </tr>
          )}
          {invoices.map((i) => {
            const overdueRow = ["SENT", "PARTIAL"].includes(i.status) && i.dueDate && i.dueDate < new Date();
            return (
              <tr key={i.id} className="hover:bg-canvas/60">
                <Td>
                  <Link href={`/billing/invoices/${i.id}`} className="font-medium hover:text-brand-700">
                    {i.number}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/clients/${i.clientId}/billing`} className="hover:text-brand-700">
                    {i.client.firstName} {i.client.lastName}
                  </Link>
                </Td>
                <Td className="text-muted">{date(i.issueDate)}</Td>
                <Td className={cn("text-muted", overdueRow && "font-medium text-red-600")}>{date(i.dueDate)}</Td>
                <Td className="text-right tabular-nums">{money(i.totalCents)}</Td>
                <Td className="text-right tabular-nums">{money(i.totalCents - i.paidCents)}</Td>
                <Td>
                  <Badge color={overdueRow ? "red" : statusColor(i.status)}>{overdueRow ? "Overdue" : INVOICE_STATUS[i.status as keyof typeof INVOICE_STATUS]}</Badge>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
