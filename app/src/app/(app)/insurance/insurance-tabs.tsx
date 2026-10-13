"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

export function InsuranceTabs() {
  const pathname = usePathname();
  if (/^\/insurance\/claims\/(?!new)[^/]+/.test(pathname)) return null;
  const active = pathname.startsWith("/insurance/unbilled") ? "unbilled" : pathname.startsWith("/insurance/payments") ? "payments" : "claims";
  return (
    <Tabs
      active={active}
      tabs={[
        { key: "claims", label: "Claims", href: "/insurance" },
        { key: "unbilled", label: "Unbilled sessions", href: "/insurance/unbilled" },
        { key: "payments", label: "Payer payments", href: "/insurance/payments" },
      ]}
    />
  );
}
