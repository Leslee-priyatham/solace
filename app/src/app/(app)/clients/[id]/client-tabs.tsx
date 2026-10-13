"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

const TABS = [
  ["", "Sessions"],
  ["summary", "Summary"],
  ["treatment-plan", "Treatment plan"],
  ["forms", "Forms"],
  ["insights", "Insights"],
  ["chart-notes", "Chart notes"],
  ["files", "Files"],
  ["billing", "Billing"],
] as const;

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;
  const rest = pathname.slice(base.length).replace(/^\//, "").split("/")[0];
  const active = TABS.some(([k]) => k === rest) ? rest : "";
  return <Tabs active={active} tabs={TABS.map(([key, label]) => ({ key, label, href: key ? `${base}/${key}` : base }))} />;
}
