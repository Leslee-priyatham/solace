import "server-only";
import { addDays, startOfDay } from "date-fns";
import { db } from "./db";

export type Slot = { start: string; end: string };

/**
 * Open slots for a provider and service duration between `from` and `days` ahead, based on weekly
 * availability rules minus booked appointments and external calendar events. Times are computed in the
 * server's local time zone.
 */
export async function openSlots(providerId: string, durationMin: number, from: Date, days: number, minNoticeHours = 24): Promise<Slot[]> {
  const to = addDays(startOfDay(from), days);
  const [rules, appts, external] = await Promise.all([
    db.availabilityRule.findMany({ where: { userId: providerId } }),
    db.appointment.findMany({ where: { providerId, status: { notIn: ["CANCELLED", "LATE_CANCEL"] }, startsAt: { lt: to }, endsAt: { gt: from } } }),
    db.externalCalendar.findMany(),
  ]);
  const busy = [
    ...appts.map((a) => [a.startsAt.getTime(), a.endsAt.getTime()] as const),
    ...external.flatMap((c) => (c.events as { start: string; end: string }[]).map((e) => [new Date(e.start).getTime(), new Date(e.end).getTime()] as const)),
  ];
  const earliest = Date.now() + minNoticeHours * 3600e3;
  const step = Math.max(15, Math.min(durationMin, 60));
  const slots: Slot[] = [];
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
    for (const r of rules.filter((x) => x.weekday === d.getDay())) {
      for (let m = r.startMin; m + durationMin <= r.endMin; m += step) {
        const s = new Date(d);
        s.setHours(0, m, 0, 0);
        const start = s.getTime();
        const end = start + durationMin * 60000;
        if (start < earliest) continue;
        if (busy.some(([bs, be]) => start < be && end > bs)) continue;
        slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
      }
    }
  }
  return slots;
}
