import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { RemindersForm } from "./reminders-form";

export const metadata = { title: "Client reminders" };

export default async function RemindersPage() {
  const p = await db.practice.findFirstOrThrow();
  const r = ((p.settings ?? {}) as { reminders?: { enabled?: boolean; channels?: string[]; first?: number; second?: number | null; formReminderDays?: number | null } }).reminders ?? {};
  return (
    <>
      <PageHeader title="Client reminders" description="Automatic reminders before sessions, delivered to each client's secure inbox and portal." />
      <RemindersForm initial={{ enabled: !!r.enabled, channels: r.channels ?? ["PORTAL"], first: r.first ?? 24, second: r.second ?? null, formReminderDays: r.formReminderDays ?? null }} />
    </>
  );
}
