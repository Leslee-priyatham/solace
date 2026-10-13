"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

const TABS = [
  ["invoices", "Invoices", "/billing"],
  ["unbilled", "Unbilled sessions", "/billing/unbilled"],
  ["payments", "Transactions", "/billing/payments"],
  ["statements", "Statements", "/billing/statements"],
  ["superbills", "Superbills", "/billing/superbills"],
  ["analytics", "Analytics", "/billing/analytics"],
] as const;

export function BillingTabs() {
  const pathname = usePathname();
  const active = TABS.find(([key]) => pathname.startsWith(`/billing/${key}`))?.[0] ?? "invoices";
  if (/^\/billing\/(invoices|payments|superbills)\/[^/]+/.test(pathname)) return null;
  return <Tabs active={active} tabs={TABS.map(([key, label, href]) => ({ key, label, href }))} />;
}
