"use client";

import { usePathname } from "next/navigation";
import { Plus, Banknote } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export function BillingActions() {
  const pathname = usePathname();
  if (/^\/billing\/(invoices|payments|superbills)\/[^/]+/.test(pathname)) return null;
  return (
    <>
      <ButtonLink href="/billing/payments/new" variant="outline">
        <Banknote className="size-4" /> Record payment
      </ButtonLink>
      <ButtonLink href="/billing/invoices/new">
        <Plus className="size-4" /> New invoice
      </ButtonLink>
    </>
  );
}
