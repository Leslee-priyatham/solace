import { addDays, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; new?: string; client?: string; provider?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "day" || sp.view === "month" ? sp.view : "week";
  const anchor = sp.date ? new Date(`${sp.date}T12:00:00`) : new Date();
  const prefs = (user.preferences ?? {}) as { weekStartsOn?: 0 | 1 };
  const weekStartsOn = prefs.weekStartsOn ?? 1;
  const from = view === "day" ? startOfDay(anchor) : view === "week" ? startOfWeek(anchor, { weekStartsOn }) : startOfWeek(startOfMonth(anchor), { weekStartsOn });
  const to = view === "day" ? addDays(from, 1) : addDays(from, view === "week" ? 7 : 42);
  const providerFilter = sp.provider === "all" ? undefined : sp.provider || user.id;

  const [appointments, external, clients, services, providers, locations] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from }, ...(providerFilter ? { providerId: providerFilter } : {}) },
      include: { client: true, service: true, provider: { select: { firstName: true, lastName: true } }, session: { select: { id: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.externalCalendar.findMany(),
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT"] } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, defaultServiceId: true } }),
    db.service.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" } }, select: { id: true, firstName: true, lastName: true } }),
    db.location.findMany(),
  ]);

  const externalEvents = external.flatMap((c) =>
    (c.events as { title: string; start: string; end: string }[])
      .filter((e) => new Date(e.start) < to && new Date(e.end) > from)
      .map((e) => ({ ...e, calendar: c.name, color: c.color })),
  );

  return (
    <CalendarView
      view={view}
      anchor={anchor.toISOString()}
      from={from.toISOString()}
      weekStartsOn={weekStartsOn}
      currentUserId={user.id}
      providerFilter={sp.provider ?? user.id}
      openNew={sp.new === "1"}
      presetClientId={sp.client}
      appointments={appointments.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        status: a.status,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        modality: a.modality,
        clientId: a.clientId,
        clientName: a.client ? `${a.client.preferredName || a.client.firstName} ${a.client.lastName}` : null,
        serviceId: a.serviceId,
        serviceName: a.service?.name ?? null,
        providerId: a.providerId,
        providerName: `${a.provider.firstName} ${a.provider.lastName}`,
        locationId: a.locationId,
        seriesId: a.seriesId,
        recurrence: a.recurrence,
        notes: a.notes,
        feeCents: a.feeCents,
        bookedOnline: a.bookedOnline,
        sessionId: a.session?.id ?? null,
      }))}
      external={externalEvents}
      clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, defaultServiceId: c.defaultServiceId }))}
      services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, rateCents: s.rateCents, cpt: s.cpt }))}
      providers={providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
      locations={locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind }))}
    />
  );
}
