import { headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CalendarSettings } from "./calendar-settings";

export const metadata = { title: "Calendars" };

export default async function CalendarsSettingsPage() {
  const u = await requireUser();
  const prefs = (u.preferences ?? {}) as { weekStartsOn?: 0 | 1; icalToken?: string | null };
  const cals = await db.externalCalendar.findMany({ orderBy: { createdAt: "asc" } });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return (
    <>
      <PageHeader title="Calendars" description="Choose how your calendar looks, and connect other calendars to avoid double-booking." />
      <CalendarSettings
        weekStartsOn={prefs.weekStartsOn ?? 1}
        feedUrl={prefs.icalToken ? `${origin}/api/public/ical/${prefs.icalToken}` : null}
        calendars={cals.map((c) => ({ id: c.id, name: c.name, color: c.color, events: (c.events as unknown[]).length, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null }))}
      />
    </>
  );
}
