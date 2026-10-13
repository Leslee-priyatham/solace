"use server";

import { revalidatePath } from "next/cache";
import { addDays, addMonths, addWeeks } from "date-fns";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { nextInvoiceNumber } from "@/lib/billing";

type R = { error?: string; ok?: boolean; id?: string };

export type AppointmentInput = {
  id?: string;
  kind: "SESSION" | "TIME_OFF" | "OTHER";
  title?: string;
  clientId?: string | null;
  providerId?: string;
  serviceId?: string | null;
  modality: "IN_PERSON" | "TELEHEALTH";
  locationId?: string | null;
  startsAt: string;
  durationMin: number;
  recurrence?: "NONE" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  occurrences?: number;
  notes?: string;
  feeCents?: number | null;
  scope?: "this" | "series";
};

function step(date: Date, rec: string, n: number) {
  if (rec === "WEEKLY") return addWeeks(date, n);
  if (rec === "BIWEEKLY") return addWeeks(date, n * 2);
  if (rec === "MONTHLY") return addMonths(date, n);
  return date;
}

async function conflicts(providerId: string, start: Date, end: Date, ignoreIds: string[] = []) {
  return db.appointment.findFirst({
    where: {
      providerId,
      id: { notIn: ignoreIds },
      status: { notIn: ["CANCELLED", "LATE_CANCEL"] },
      startsAt: { lt: end },
      endsAt: { gt: start },
    },
    include: { client: true },
  });
}

export async function saveAppointment(input: AppointmentInput, allowConflict = false): Promise<R & { conflict?: string }> {
  const user = await requireUser();
  const providerId = input.providerId || user.id;
  const start = new Date(input.startsAt);
  if (isNaN(start.getTime())) return { error: "Choose a valid date and time." };
  if (input.durationMin <= 0) return { error: "Duration must be more than zero." };
  if (input.kind === "SESSION" && !input.clientId) return { error: "Choose a client for the session." };
  const end = new Date(start.getTime() + input.durationMin * 60000);

  if (!allowConflict && input.kind !== "TIME_OFF") {
    const c = await conflicts(providerId, start, end, input.id ? [input.id] : []);
    if (c) return { conflict: `This overlaps ${c.client ? `${c.client.firstName} ${c.client.lastName}` : c.title ?? "another event"} at ${c.startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` };
  }

  const service = input.serviceId ? await db.service.findUnique({ where: { id: input.serviceId } }) : null;
  const base = {
    kind: input.kind,
    title: input.title || (input.kind === "TIME_OFF" ? "Time off" : service?.name ?? null),
    clientId: input.kind === "SESSION" ? input.clientId : null,
    providerId,
    serviceId: input.serviceId || null,
    modality: input.modality,
    locationId: input.locationId || null,
    notes: input.notes || null,
    feeCents: input.feeCents ?? service?.rateCents ?? null,
  };

  if (input.id) {
    const existing = await db.appointment.findUniqueOrThrow({ where: { id: input.id } });
    if (input.scope === "series" && existing.seriesId) {
      // Shift every future occurrence by the same offset and apply the new details.
      const offset = start.getTime() - existing.startsAt.getTime();
      const series = await db.appointment.findMany({ where: { seriesId: existing.seriesId, startsAt: { gte: existing.startsAt } } });
      for (const a of series) {
        const s = new Date(a.startsAt.getTime() + offset);
        await db.appointment.update({ where: { id: a.id }, data: { ...base, startsAt: s, endsAt: new Date(s.getTime() + input.durationMin * 60000) } });
      }
    } else {
      await db.appointment.update({ where: { id: input.id }, data: { ...base, startsAt: start, endsAt: end } });
    }
    await audit(user.id, "update", "Appointment", input.id);
  } else {
    const rec = input.recurrence ?? "NONE";
    const count = rec === "NONE" ? 1 : Math.min(Math.max(input.occurrences ?? 12, 1), 52);
    const seriesId = rec === "NONE" ? null : token(8);
    for (let i = 0; i < count; i++) {
      const s = step(start, rec, i);
      await db.appointment.create({ data: { ...base, startsAt: s, endsAt: new Date(s.getTime() + input.durationMin * 60000), recurrence: rec, seriesId } });
    }
    await audit(user.id, "create", "Appointment", undefined, `${count} occurrence(s)`);
  }
  revalidatePath("/calendar");
  revalidatePath("/home");
  return { ok: true };
}

export async function setAppointmentStatus(id: string, status: string, chargeFee = false): Promise<R> {
  const user = await requireUser();
  const a = await db.appointment.update({ where: { id }, data: { status }, include: { client: true } });
  if (chargeFee && a.clientId && (status === "LATE_CANCEL" || status === "NO_SHOW")) {
    const p = await db.practice.findFirst();
    const fee = ((p?.settings ?? {}) as { billing?: { lateCancelFeeCents?: number } }).billing?.lateCancelFeeCents ?? 0;
    if (fee > 0) {
      await db.invoice.create({
        data: {
          number: await nextInvoiceNumber(),
          clientId: a.clientId,
          status: "DRAFT",
          totalCents: fee,
          items: { create: [{ description: status === "NO_SHOW" ? "Missed appointment fee" : "Late cancellation fee", date: a.startsAt, unitCents: fee }] },
        },
      });
    }
  }
  await audit(user.id, "status", "Appointment", id, status);
  revalidatePath("/calendar");
  revalidatePath("/home");
  return { ok: true };
}

export async function deleteAppointment(id: string, scope: "this" | "series" = "this"): Promise<R> {
  const user = await requireUser();
  const a = await db.appointment.findUniqueOrThrow({ where: { id }, include: { session: true } });
  if (a.session) return { error: "This appointment has a session note attached. Cancel it instead of deleting." };
  if (scope === "series" && a.seriesId) {
    await db.appointment.deleteMany({ where: { seriesId: a.seriesId, startsAt: { gte: a.startsAt }, session: null } });
  } else {
    await db.appointment.delete({ where: { id } });
  }
  await audit(user.id, "delete", "Appointment", id, scope);
  revalidatePath("/calendar");
  return { ok: true };
}

/** Confirms an online booking request. */
export async function confirmRequest(id: string): Promise<R> {
  return setAppointmentStatus(id, "SCHEDULED");
}

export async function syncExternalCalendars(): Promise<R> {
  await requireUser();
  const cals = await db.externalCalendar.findMany();
  for (const c of cals) {
    try {
      const res = await fetch(c.icsUrl.replace(/^webcal:/, "https:"), { cache: "no-store" });
      if (!res.ok) continue;
      const events = parseIcs(await res.text());
      await db.externalCalendar.update({ where: { id: c.id }, data: { events, lastSyncedAt: new Date() } });
    } catch {
      // keep previous events on failure
    }
  }
  revalidatePath("/calendar");
  return { ok: true };
}

/** Minimal VEVENT parser: summary + start/end for the next 120 days (no RRULE expansion beyond weekly). */
function parseIcs(text: string) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const parse = (v: string) => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
    return z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  };
  const horizon = addDays(new Date(), 120);
  const from = addDays(new Date(), -30);
  const out: { title: string; start: string; end: string }[] = [];
  for (const b of blocks) {
    const get = (k: string) => b.match(new RegExp(`^${k}[^:]*:(.*)$`, "m"))?.[1]?.trim();
    const start = parse(get("DTSTART") ?? "");
    const end = parse(get("DTEND") ?? "") ?? (start ? new Date(start.getTime() + 3600e3) : null);
    if (!start || !end) continue;
    const title = (get("SUMMARY") ?? "Busy").replace(/\\,/g, ",");
    const rrule = get("RRULE");
    const dur = end.getTime() - start.getTime();
    if (rrule?.includes("FREQ=WEEKLY")) {
      for (let t = start; t < horizon; t = addWeeks(t, 1)) if (t >= from) out.push({ title, start: t.toISOString(), end: new Date(t.getTime() + dur).toISOString() });
    } else if (end >= from && start <= horizon) {
      out.push({ title, start: start.toISOString(), end: end.toISOString() });
    }
  }
  return out.slice(0, 2000);
}
