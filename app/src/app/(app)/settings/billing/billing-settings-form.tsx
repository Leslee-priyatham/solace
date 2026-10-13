"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Field, Input, Notice, Textarea } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { saveBillingSettings } from "../actions";

export function BillingSettingsForm({ currency, initial }: { currency: string; initial: { invoiceDueDays: number; lateCancelFee: string; paymentInstructions: string; invoiceFooter: string } }) {
  const [f, setF] = useState(initial);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Invoices" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Payment due (days after issue)">
            <Input type="number" min={0} value={f.invoiceDueDays} onChange={(e) => setF({ ...f, invoiceDueDays: Number(e.target.value) })} />
          </Field>
          <Field label={`Late cancellation / no-show fee (${currency})`} hint="Offered when you mark an appointment late-cancelled or no-show.">
            <Input type="number" step="0.01" value={f.lateCancelFee} onChange={(e) => setF({ ...f, lateCancelFee: e.target.value })} />
          </Field>
          <Field label="How clients can pay" hint="Shown on invoices in the client portal — bank details, payment link, cheques…" className="sm:col-span-2">
            <Textarea rows={3} value={f.paymentInstructions} onChange={(e) => setF({ ...f, paymentInstructions: e.target.value })} />
          </Field>
          <Field label="Default invoice note" className="sm:col-span-2">
            <Textarea rows={2} value={f.invoiceFooter} onChange={(e) => setF({ ...f, invoiceFooter: e.target.value })} />
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton action={() => saveBillingSettings({ invoiceDueDays: f.invoiceDueDays, lateCancelFeeCents: Math.round(Number(f.lateCancelFee || 0) * 100), paymentInstructions: f.paymentInstructions, invoiceFooter: f.invoiceFooter })} />
        </div>
      </Card>
      <Notice tone="info">
        Card payments: this installation records payments you receive (card terminal, bank transfer, cash, cheque). Online card collection needs a payment processor such as Stripe connected to your own account. Business details used on invoices are in{" "}
        <Link href="/settings/practice" className="font-medium underline">
          Practice settings
        </Link>
        .
      </Notice>
    </div>
  );
}
