import "server-only";
import { differenceInHours, format, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { db } from "./db";

export type Range = "30d" | "90d" | "12m" | "all";
export type TileData =
  | { kind: "bar"; data: Record<string, string | number>[]; keys: string[]; currency?: boolean }
  | { kind: "line"; data: Record<string, string | number | null>[]; keys: string[] }
  | { kind: "donut"; data: { label: string; value: number }[] }
  | { kind: "number"; value: string; hint?: string }
  | { kind: "list"; rows: { label: string; value: string; href?: string }[] };

export function rangeStart(range: Range) {
  if (range === "30d") return subDays(new Date(), 30);
  if (range === "90d") return subDays(new Date(), 90);
  if (range === "12m") return subMonths(new Date(), 12);
  return new Date(2000, 0, 1);
}

function bucket(range: Range) {
  return range === "30d" || range === "90d" ? { fn: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }), fmt: "MMM d" } : { fn: startOfMonth, fmt: "MMM yy" };
}

function series<T>(items: T[], getDate: (t: T) => Date, range: Range, value: (t: T[]) => number) {
  const b = bucket(range);
  const groups = new Map<number, T[]>();
  for (const it of items) {
    const k = b.fn(getDate(it)).getTime();
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return [...groups.entries()].sort((a, c) => a[0] - c[0]).map(([k, list]) => ({ label: format(new Date(k), b.fmt), value: value(list) }));
}

export async function computeTile(metric: string, range: Range, providerId?: string): Promise<TileData> {
  const from = rangeStart(range);
  const prov = providerId ? { providerId } : {};
  switch (metric) {
    case "sessions_over_time": {
      const s = await db.session.findMany({ where: { startedAt: { gte: from }, ...prov }, select: { startedAt: true } });
      if (!s.length) return { kind: "number", value: "0", hint: "No sessions in this period" };
      return { kind: "bar", keys: ["Sessions"], data: series(s, (x) => x.startedAt, range, (l) => l.length).map((r) => ({ label: r.label, Sessions: r.value })) };
    }
    case "caseload": {
      const g = await db.client.groupBy({ by: ["status"], _count: true, where: providerId ? { providerId } : {} });
      return { kind: "donut", data: g.map((x) => ({ label: x.status.charAt(0) + x.status.slice(1).toLowerCase(), value: x._count })) };
    }
    case "days_to_signoff": {
      const docs = await db.noteDocument.findMany({ where: { status: "SIGNED", signedAt: { gte: from }, session: prov }, include: { session: { select: { startedAt: true } } } });
      if (!docs.length) return { kind: "number", value: "—", hint: "No signed notes in this period" };
      const avg = docs.reduce((n, d) => n + differenceInHours(d.signedAt!, d.session?.startedAt ?? d.createdAt), 0) / docs.length / 24;
      const unsigned = await db.noteDocument.count({ where: { status: "DRAFT", session: prov } });
      return { kind: "number", value: `${avg.toFixed(1)} days`, hint: `${docs.length} notes signed · ${unsigned} waiting` };
    }
    case "revenue": {
      const p = await db.payment.findMany({ where: { receivedAt: { gte: from } }, select: { receivedAt: true, amountCents: true, refundedCents: true } });
      if (!p.length) return { kind: "number", value: "$0", hint: "No payments in this period" };
      return {
        kind: "bar",
        keys: ["Revenue"],
        currency: true,
        data: series(p, (x) => x.receivedAt, range, (l) => l.reduce((n, x) => n + x.amountCents - x.refundedCents, 0) / 100).map((r) => ({ label: r.label, Revenue: r.value })),
      };
    }
    case "outstanding": {
      const inv = await db.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL"] } }, include: { client: true } });
      const by = new Map<string, { label: string; cents: number; href: string }>();
      for (const i of inv) {
        const cur = by.get(i.clientId) ?? { label: `${i.client.firstName} ${i.client.lastName}`, cents: 0, href: `/clients/${i.clientId}/billing` };
        cur.cents += i.totalCents - i.paidCents;
        by.set(i.clientId, cur);
      }
      const rows = [...by.values()].sort((a, b) => b.cents - a.cents).slice(0, 8);
      return { kind: "list", rows: rows.length ? rows.map((r) => ({ label: r.label, value: `$${(r.cents / 100).toFixed(2)}`, href: r.href })) : [{ label: "No outstanding balances", value: "" }] };
    }
    case "appointment_outcomes": {
      const g = await db.appointment.groupBy({ by: ["status"], _count: true, where: { kind: "SESSION", startsAt: { gte: from, lte: new Date() }, ...prov } });
      return { kind: "donut", data: g.map((x) => ({ label: x.status.replace("_", " ").toLowerCase(), value: x._count })) };
    }
    case "measures": {
      const m = await db.measureScore.findMany({ where: { takenAt: { gte: from } }, orderBy: { takenAt: "asc" } });
      if (!m.length) return { kind: "number", value: "—", hint: "No PHQ-9 / GAD-7 results in this period" };
      const phq = series(m.filter((x) => x.measure === "PHQ9"), (x) => x.takenAt, range, (l) => Math.round((l.reduce((n, x) => n + x.score, 0) / l.length) * 10) / 10);
      const gad = series(m.filter((x) => x.measure === "GAD7"), (x) => x.takenAt, range, (l) => Math.round((l.reduce((n, x) => n + x.score, 0) / l.length) * 10) / 10);
      const labels = [...new Set([...phq, ...gad].map((x) => x.label))];
      return { kind: "line", keys: ["PHQ-9", "GAD-7"], data: labels.map((l) => ({ label: l, "PHQ-9": phq.find((x) => x.label === l)?.value ?? null, "GAD-7": gad.find((x) => x.label === l)?.value ?? null })) };
    }
    case "new_clients": {
      const c = await db.client.findMany({ where: { createdAt: { gte: from }, ...(providerId ? { providerId } : {}) }, select: { createdAt: true } });
      if (!c.length) return { kind: "number", value: "0", hint: "No new clients in this period" };
      return { kind: "bar", keys: ["New clients"], data: series(c, (x) => x.createdAt, range, (l) => l.length).map((r) => ({ label: r.label, "New clients": r.value })) };
    }
    default:
      return { kind: "number", value: "—", hint: "Unknown report" };
  }
}
