import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PortalSettings } from "./portal-settings";

export const metadata = { title: "Client portal" };

export default async function PortalSettingsPage() {
  const p = await db.practice.findFirstOrThrow();
  const s = ((p.settings ?? {}) as { portal?: { selfScheduling?: boolean; autoConfirm?: boolean; hidePrices?: boolean; messaging?: boolean } }).portal ?? {};
  const [selfServices, demo] = await Promise.all([db.service.count({ where: { selfSchedule: true, archived: false } }), db.client.findFirst({ orderBy: { createdAt: "asc" } })]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Client portal" description="Set up how clients use the portal: forms, messaging, billing and self-scheduling." />
      <PortalSettings
        initial={{ selfScheduling: !!s.selfScheduling, autoConfirm: !!s.autoConfirm, hidePrices: !!s.hidePrices, messaging: s.messaging !== false }}
        bookingUrl={`${origin}/book/${p.slug}`}
        selfServices={selfServices}
        previewHref={demo ? `/portal/${demo.portalToken}` : null}
      />
    </>
  );
}
