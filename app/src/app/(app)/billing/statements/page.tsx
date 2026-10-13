import { db } from "@/lib/db";
import { Card, Field, Input, Select } from "@/components/ui";
import { date, money } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Statements" };

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ client?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const clients = await db.client.findMany({ orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } });
  const now = new Date();
  const from = sp.from ?? new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = sp.to ?? now.toISOString().slice(0, 10);

  let body: React.ReactNode = <p className="text-sm text-muted">Choose a client and period to build a statement of account.</p>;
  if (sp.client) {
    const range = { gte: new Date(from), lte: new Date(`${to}T23:59:59`) };
    const [client, invoices, payments, practice] = await Promise.all([
      db.client.findUniqueOrThrow({ where: { id: sp.client } }),
      db.invoice.findMany({ where: { clientId: sp.client, issueDate: range, status: { not: "DRAFT" } }, orderBy: { issueDate: "asc" } }),
      db.payment.findMany({ where: { clientId: sp.client, receivedAt: range }, orderBy: { receivedAt: "asc" } }),
      db.practice.findFirst(),
    ]);
    const rows = [
      ...invoices.map((i) => ({ when: i.issueDate, label: `Invoice ${i.number}${i.status === "VOID" ? " (void)" : ""}`, charge: i.status === "VOID" ? 0 : i.totalCents, credit: 0 })),
      ...payments.map((p) => ({ when: p.receivedAt, label: `Payment (${p.method.toLowerCase().replace("_", " ")})`, charge: 0, credit: p.amountCents - p.refundedCents })),
    ].sort((a, b) => a.when.getTime() - b.when.getTime());
    let running = 0;
    body = (
      <div className="bg-white text-sm">
        <div className="flex justify-between">
          <div>
            <div className="text-lg font-semibold">{practice?.displayName || practice?.name}</div>
            <div className="text-muted">Statement of account</div>
          </div>
          <div className="text-right">
            <div className="font-medium">
              {client.firstName} {client.lastName}
            </div>
            <div className="text-muted">
              {date(from)} – {date(to)}
            </div>
          </div>
        </div>
        <table className="mt-6 w-full">
          <thead>
            <tr className="border-b-2 border-ink text-left text-xs uppercase">
              <th className="py-2">Date</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Charges</th>
              <th className="py-2 text-right">Payments</th>
              <th className="py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  No activity in this period.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              running += r.charge - r.credit;
              return (
                <tr key={i} className="border-b border-line">
                  <td className="py-2">{date(r.when)}</td>
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-right tabular-nums">{r.charge ? money(r.charge) : ""}</td>
                  <td className="py-2 text-right tabular-nums">{r.credit ? money(r.credit) : ""}</td>
                  <td className="py-2 text-right tabular-nums">{money(running)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 text-right text-base font-semibold">Balance for period: {money(running)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="no-print p-5">
        <form className="grid items-end gap-4 sm:grid-cols-[1fr_160px_160px_auto_auto]">
          <Field label="Client">
            <Select name="client" defaultValue={sp.client ?? ""}>
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" name="from" defaultValue={from} />
          </Field>
          <Field label="To">
            <Input type="date" name="to" defaultValue={to} />
          </Field>
          <button className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">Build statement</button>
          {sp.client && <PrintButton />}
        </form>
      </Card>
      <Card className="p-8">{body}</Card>
    </div>
  );
}
