import type { Practice } from "@prisma/client";
import { date, money } from "@/lib/format";

export type InvoiceDoc = {
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  notes: string | null;
  totalCents: number;
  paidCents: number;
  client: { firstName: string; lastName: string; email: string | null; address: string | null };
  items: { id: string; date: Date; description: string; cpt: string | null; quantity: number; unitCents: number }[];
  payments: { id: string; date: Date; method: string; amountCents: number }[];
};

/** Printable invoice; used by staff and in the client portal. */
export function InvoiceDocument({ inv, practice }: { inv: InvoiceDoc; practice: Practice | null }) {
  const currency = practice?.currency ?? "USD";
  const balance = inv.totalCents - inv.paidCents;
  return (
    <div className="bg-white p-10 text-sm">
      <div className="flex justify-between gap-8">
        <div>
          <div className="text-xl font-semibold">{practice?.displayName || practice?.name}</div>
          <div className="mt-1 whitespace-pre-line text-muted">{[practice?.address, practice?.phone, practice?.email].filter(Boolean).join("\n")}</div>
          {practice?.taxId && <div className="text-muted">Tax ID {practice.taxId}</div>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tracking-tight">INVOICE</div>
          <div className="mt-1 text-muted">{inv.number}</div>
          {inv.status === "VOID" && <div className="mt-2 font-semibold text-red-600">VOID</div>}
          {inv.status === "PAID" && <div className="mt-2 font-semibold text-emerald-600">PAID</div>}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Bill to</div>
          <div className="mt-1 font-medium">
            {inv.client.firstName} {inv.client.lastName}
          </div>
          <div className="whitespace-pre-line text-muted">{[inv.client.address, inv.client.email].filter(Boolean).join("\n")}</div>
        </div>
        <div className="text-right">
          <div>
            <span className="text-muted">Issued </span>
            {date(inv.issueDate)}
          </div>
          {inv.dueDate && (
            <div>
              <span className="text-muted">Due </span>
              {date(inv.dueDate)}
            </div>
          )}
        </div>
      </div>
      <table className="mt-8 w-full">
        <thead>
          <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide">
            <th className="py-2">Date</th>
            <th className="py-2">Description</th>
            <th className="py-2">Code</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-2">{date(i.date)}</td>
              <td className="py-2">{i.description}</td>
              <td className="py-2">{i.cpt ?? ""}</td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right tabular-nums">{money(i.unitCents, currency)}</td>
              <td className="py-2 text-right tabular-nums">{money(i.unitCents * i.quantity, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto w-64 space-y-1">
        <div className="flex justify-between">
          <span>Total</span>
          <span className="tabular-nums">{money(inv.totalCents, currency)}</span>
        </div>
        {inv.payments.map((p) => (
          <div key={p.id} className="flex justify-between text-muted">
            <span>
              Paid {date(p.date)} ({p.method.toLowerCase().replace("_", " ")})
            </span>
            <span className="tabular-nums">−{money(p.amountCents, currency)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink pt-1 text-base font-semibold">
          <span>Balance due</span>
          <span className="tabular-nums">{money(Math.max(0, balance), currency)}</span>
        </div>
      </div>
      {inv.notes && <p className="mt-8 whitespace-pre-line text-muted">{inv.notes}</p>}
    </div>
  );
}
