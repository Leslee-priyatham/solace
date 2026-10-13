"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

export function FormsTabs() {
  const pathname = usePathname();
  const active = pathname.startsWith("/forms/packets") ? "packets" : pathname.startsWith("/forms/library") ? "library" : pathname.startsWith("/forms/requests") ? "requests" : "forms";
  return (
    <Tabs
      active={active}
      tabs={[
        { key: "forms", label: "Forms", href: "/forms" },
        { key: "packets", label: "Packets", href: "/forms/packets" },
        { key: "library", label: "Template library", href: "/forms/library" },
        { key: "requests", label: "Sent & completed", href: "/forms/requests" },
      ]}
    />
  );
}
