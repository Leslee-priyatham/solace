import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MessagingSettings } from "./messaging-settings";

export const metadata = { title: "Messaging settings" };

export default async function MessagingSettingsPage() {
  const u = await requireUser();
  const blockedIds = ((await db.setting.findUnique({ where: { key: "messaging.blocked" } }))?.value ?? []) as string[];
  const blocked = await db.client.findMany({ where: { id: { in: blockedIds } }, select: { id: true, firstName: true, lastName: true } });
  return (
    <>
      <PageHeader title="Messaging" description="These settings apply to your own inbox." />
      <MessagingSettings displayName={u.messagingName ?? `${u.firstName} ${u.lastName}`} blocked={blocked.map((b) => ({ id: b.id, name: `${b.firstName} ${b.lastName}` }))} />
    </>
  );
}
