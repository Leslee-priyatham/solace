import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { BillingSettingsForm } from "./billing-settings-form";

export const metadata = { title: "Billing settings" };

export default async function BillingSettingsPage() {
  const p = await db.practice.findFirstOrThrow();
  const b = ((p.settings ?? {}) as { billing?: { invoiceDueDays?: number; lateCancelFeeCents?: number; paymentInstructions?: string; invoiceFooter?: string } }).billing ?? {};
  return (
    <>
      <PageHeader title="Billing settings" description="Defaults for invoices and fees." />
      <BillingSettingsForm
        currency={p.currency}
        initial={{ invoiceDueDays: b.invoiceDueDays ?? 14, lateCancelFee: ((b.lateCancelFeeCents ?? 0) / 100).toFixed(2), paymentInstructions: b.paymentInstructions ?? "", invoiceFooter: b.invoiceFooter ?? "" }}
      />
    </>
  );
}
