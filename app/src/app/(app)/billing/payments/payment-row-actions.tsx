"use client";

import { Menu, useToast } from "@/components/client-ui";
import { deletePayment, refundPayment } from "../actions";

export function PaymentRowActions({ id, refundable }: { id: string; refundable: number }) {
  const toast = useToast();
  return (
    <Menu
      items={[
        refundable > 0
          ? {
              label: "Refund…",
              onClick: async () => {
                const v = prompt(`Refund amount (up to ${(refundable / 100).toFixed(2)})`, (refundable / 100).toFixed(2));
                if (!v) return;
                const r = await refundPayment(id, Math.round(Number(v) * 100));
                toast(r.error ?? "Refund recorded", r.error ? "error" : "success");
              },
            }
          : null,
        { label: "Delete payment", danger: true, onClick: async () => confirm("Delete this payment record? Invoices it paid will reopen.") && toast((await deletePayment(id)).error ?? "Payment deleted") },
      ]}
    />
  );
}
