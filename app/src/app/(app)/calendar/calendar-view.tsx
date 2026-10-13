"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, startOfDay, differenceInMinutes } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, Repeat, RefreshCw, Loader2, FileText, Mic, Ban } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Notice, Select, Textarea, cn, statusColor } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { APPOINTMENT_STATUS } from "@/lib/constants";
import { money, time } from "@/lib/format";
import { deleteAppointment, saveAppointment, setAppointmentStatus, syncExternalCalendars, type AppointmentInput } from "./actions";

type Appt = {
  id: string;
  kind: string;
  title: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  modality: string;
  clientId: string | null;
  clientName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  providerId: string;
  providerName: string;
  locationId: string | null;
  seriesId: string | null;
  recurrence: string | null;
  notes: string | null;
  feeCents: number | null;
  bookedOnline: boolean;
  sessionId: string | null;
};
type Ext = { title: string; start: string; end: string; calendar: string; color: string };
type Opt = { id: string; name: string };
type Svc = { id: string; name: string; durationMin: number; rateCents: number; cpt: string | null };

const HOUR_PX = 56;
const START_HOUR = 6;
const END_HOUR = 22;

/**
 * The current time, on the client only: null during the server render and hydration (so both agree even
 * when the server runs in another timezone), then refreshed every minute.
 */
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function CalendarView(props: {
  view: "day" | "week" | "month";
  anchor: string;
  from: string;
  weekStartsOn: 0 | 1;
  currentUserId: string;
  providerFilter: string;
  openNew: boolean;
  presetClientId?: string;
  appointments: Appt[];
  external: Ext[];
  clients: (Opt & { defaultServiceId: string | null })[];
  services: Svc[];
  providers: Opt[];
  locations: (Opt & { kind: string })[];
}) {
  const router = useRouter();
  const anchor = new Date(props.anchor);
  const from = new Date(props.from);
  const now = useNow();
  const [draft, setDraft] = useState<Partial<AppointmentInput> | null>(props.openNew ? { kind: "SESSION", clientId: props.presetClientId } : null);
  const [selected, setSelected] = useState<Appt | null>(null);
  const [syncing, startSync] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (8 - START_HOUR) * HOUR_PX;
  }, [props.view]);

  const go = (patch: { view?: string; date?: Date; provider?: string }) => {
    const p = new URLSearchParams();
    p.set("view", patch.view ?? props.view);
    p.set("date", format(patch.date ?? anchor, "yyyy-MM-dd"));
    const prov = patch.provider ?? props.providerFilter;
    if (prov !== props.currentUserId) p.set("provider", prov);
    router.push(`/calendar?${p}`);
  };
  const shift = (dir: -1 | 1) => go({ date: props.view === "day" ? addDays(anchor, dir) : props.view === "week" ? addWeeks(anchor, dir) : addMonths(anchor, dir) });
  const days = props.view === "day" ? [from] : Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const title =
    props.view === "month" ? format(anchor, "MMMM yyyy") : props.view === "day" ? format(anchor, "EEEE, MMMM d, yyyy") : `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;

  const openSlot = (day: Date, hour: number, minutes = 0) => {
    const d = new Date(day);
    d.setHours(hour, minutes, 0, 0);
    setDraft({ kind: "SESSION", startsAt: d.toISOString(), durationMin: props.services[0]?.durationMin ?? 50, modality: "TELEHEALTH", clientId: props.presetClientId });
  };

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="mr-2 text-2xl font-semibold">Calendar</h1>
        <Button variant="outline" size="sm" onClick={() => go({ date: new Date() })}>
          Today
        </Button>
        <div className="flex">
          <button onClick={() => shift(-1)} className="rounded-l-lg border border-line bg-white p-2 hover:bg-canvas" aria-label="Previous">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => shift(1)} className="-ml-px rounded-r-lg border border-line bg-white p-2 hover:bg-canvas" aria-label="Next">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <span className="font-semibold">{title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {props.providers.length > 1 && (
            <Select value={props.providerFilter} onChange={(e) => go({ provider: e.target.value })} className="w-44">
              <option value="all">All clinicians</option>
              {props.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === props.currentUserId ? "My calendar" : p.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
            {(["day", "week", "month"] as const).map((v) => (
              <button key={v} onClick={() => go({ view: v })} className={cn("rounded-md px-3 py-1 text-sm font-medium capitalize", props.view === v ? "bg-brand-50 text-brand-800" : "text-muted")}>
                {v}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" title="Refresh external calendars" disabled={syncing} onClick={() => startSync(async () => void (await syncExternalCalendars()))}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
          <Button variant="outline" onClick={() => setDraft({ kind: "TIME_OFF", startsAt: new Date().toISOString(), durationMin: 60, modality: "IN_PERSON" })}>
            <Ban className="size-4" /> Time off
          </Button>
          <Button onClick={() => setDraft({ kind: "SESSION", clientId: props.presetClientId })}>
            <Plus className="size-4" /> New appointment
          </Button>
        </div>
      </div>

      {props.view === "month" ? (
        <MonthGrid anchor={anchor} from={from} appointments={props.appointments} external={props.external} onSelect={setSelected} onDay={(d) => go({ view: "day", date: d })} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
            <div />
            {days.map((d) => (
              <button key={d.toISOString()} onClick={() => go({ view: "day", date: d })} className="border-l border-line py-2 text-center">
                <div className="text-xs uppercase text-muted">{format(d, "EEE")}</div>
                <div className={cn("mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold", now && isSameDay(d, now) && "bg-brand-600 text-white")}>{format(d, "d")}</div>
              </button>
            ))}
          </div>
          <div ref={scroller} className="relative flex-1 overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))`, height: (END_HOUR - START_HOUR) * HOUR_PX }}>
              <div className="relative">
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div key={i} className="absolute right-2 -translate-y-2 text-[11px] text-muted" style={{ top: i * HOUR_PX }}>
                    {i === 0 ? "" : format(new Date(2000, 0, 1, START_HOUR + i), "h a")}
                  </div>
                ))}
              </div>
              {days.map((d) => (
                <DayColumn
                  key={d.toISOString()}
                  day={d}
                  appointments={props.appointments.filter((a) => isSameDay(new Date(a.startsAt), d))}
                  external={props.external.filter((e) => isSameDay(new Date(e.start), d))}
                  onSlot={(h, m) => openSlot(d, h, m)}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {draft && (
        <AppointmentModal
          initial={draft}
          clients={props.clients}
          services={props.services}
          providers={props.providers}
          locations={props.locations}
          currentUserId={props.currentUserId}
          onClose={() => setDraft(null)}
        />
      )}
      {selected && (
        <DetailModal
          appt={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            const a = selected;
            setSelected(null);
            setDraft({
              id: a.id,
              kind: a.kind as AppointmentInput["kind"],
              title: a.title ?? undefined,
              clientId: a.clientId,
              providerId: a.providerId,
              serviceId: a.serviceId,
              modality: a.modality as AppointmentInput["modality"],
              locationId: a.locationId,
              startsAt: a.startsAt,
              durationMin: differenceInMinutes(new Date(a.endsAt), new Date(a.startsAt)),
              notes: a.notes ?? undefined,
              feeCents: a.feeCents,
              recurrence: (a.seriesId ? "WEEKLY" : "NONE") as AppointmentInput["recurrence"],
              scope: a.seriesId ? "this" : undefined,
            });
          }}
        />
      )}
    </div>
  );
}

function DayColumn({ day, appointments, external, onSlot, onSelect }: { day: Date; appointments: Appt[]; external: Ext[]; onSlot: (h: number, m: number) => void; onSelect: (a: Appt) => void }) {
  const dayStart = startOfDay(day).getTime() + START_HOUR * 3600e3;
  const pos = (s: string, e: string) => {
    const top = ((new Date(s).getTime() - dayStart) / 3600e3) * HOUR_PX;
    const h = Math.max(((new Date(e).getTime() - new Date(s).getTime()) / 3600e3) * HOUR_PX, 20);
    return { top, height: h };
  };
  const now = useNow();
  const nowTop = now && isSameDay(day, now) ? ((now.getTime() - dayStart) / 3600e3) * HOUR_PX : null;
  const showNow = nowTop !== null && nowTop >= 0 && nowTop <= (END_HOUR - START_HOUR) * HOUR_PX;
  return (
    <div
      className="relative border-l border-line"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const y = e.nativeEvent.offsetY;
        const minutes = Math.floor((y / HOUR_PX) * 60 / 15) * 15;
        onSlot(START_HOUR + Math.floor(minutes / 60), minutes % 60);
      }}
    >
      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
        <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
      ))}
      {showNow && <div className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-red-500" style={{ top: nowTop }} />}
      {external.map((e, i) => (
        <div key={`x${i}`} className="pointer-events-none absolute left-1 right-1 overflow-hidden rounded-md border border-dashed px-1.5 py-0.5 text-[11px] text-slate-600" style={{ ...pos(e.start, e.end), borderColor: e.color, background: `${e.color}22` }}>
          {e.title} · {e.calendar}
        </div>
      ))}
      {appointments.map((a) => {
        const cancelled = ["CANCELLED", "LATE_CANCEL", "NO_SHOW"].includes(a.status);
        const timeOff = a.kind === "TIME_OFF";
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className={cn(
              "absolute left-1 right-1 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs shadow-sm",
              timeOff ? "bg-slate-200 text-slate-700" : a.status === "REQUESTED" ? "border border-dashed border-amber-500 bg-amber-50 text-amber-900" : cancelled ? "bg-slate-100 text-slate-500 line-through" : a.status === "COMPLETED" ? "bg-emerald-600 text-white" : "bg-brand-600 text-white",
            )}
            style={pos(a.startsAt, a.endsAt)}
          >
            <div className="truncate font-semibold">{a.clientName ?? a.title ?? "Busy"}</div>
            <div className="truncate opacity-90">
              {time(a.startsAt)}
              {a.modality === "TELEHEALTH" && !timeOff ? " · video" : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({ anchor, from, appointments, external, onSelect, onDay }: { anchor: Date; from: Date; appointments: Appt[]; external: Ext[]; onSelect: (a: Appt) => void; onDay: (d: Date) => void }) {
  const now = useNow();
  // Always six weeks so the grid height stays stable between months.
  const cells = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  return (
    <div className="grid flex-1 grid-cols-7 overflow-hidden rounded-xl border border-line bg-white">
      {cells.slice(0, 7).map((d) => (
        <div key={`h${d.toISOString()}`} className="border-b border-line py-2 text-center text-xs uppercase text-muted">
          {format(d, "EEE")}
        </div>
      ))}
      {cells.map((d) => {
        const items = appointments.filter((a) => isSameDay(new Date(a.startsAt), d));
        const ext = external.filter((e) => isSameDay(new Date(e.start), d));
        return (
          <div key={d.toISOString()} className={cn("min-h-24 border-b border-r border-line p-1.5", !isSameMonth(d, anchor) && "bg-canvas/60")}>
            <button onClick={() => onDay(d)} className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium", now && isSameDay(d, now) ? "bg-brand-600 text-white" : "hover:bg-black/5")}>
              {format(d, "d")}
            </button>
            <div className="space-y-0.5">
              {items.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => onSelect(a)} className={cn("block w-full truncate rounded px-1 text-left text-[11px]", a.kind === "TIME_OFF" ? "bg-slate-200" : "bg-brand-50 text-brand-900")}>
                  {time(a.startsAt)} {a.clientName ?? a.title}
                </button>
              ))}
              {ext.slice(0, 1).map((e, i) => (
                <div key={i} className="truncate rounded px-1 text-[11px] text-slate-500">
                  {e.title}
                </div>
              ))}
              {items.length > 3 && <div className="px-1 text-[11px] text-muted">+{items.length - 3} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Math.ceil(Date.now() / 900000) * 900000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function AppointmentModal({
  initial,
  clients,
  services,
  providers,
  locations,
  currentUserId,
  onClose,
}: {
  initial: Partial<AppointmentInput>;
  clients: (Opt & { defaultServiceId: string | null })[];
  services: Svc[];
  providers: Opt[];
  locations: (Opt & { kind: string })[];
  currentUserId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState(initial.kind ?? "SESSION");
  const [clientId, setClientId] = useState(initial.clientId ?? "");
  const [serviceId, setServiceId] = useState(initial.serviceId ?? services[0]?.id ?? "");
  const [providerId, setProviderId] = useState(initial.providerId ?? currentUserId);
  const [modality, setModality] = useState(initial.modality ?? "TELEHEALTH");
  const [locationId, setLocationId] = useState(initial.locationId ?? "");
  const [start, setStart] = useState(toLocalInput(initial.startsAt));
  const [duration, setDuration] = useState(String(initial.durationMin ?? services.find((s) => s.id === serviceId)?.durationMin ?? 50));
  const [recurrence, setRecurrence] = useState(initial.id ? "NONE" : initial.recurrence ?? "NONE");
  const [occurrences, setOccurrences] = useState("12");
  const [title, setTitle] = useState(initial.title ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [fee, setFee] = useState(initial.feeCents != null ? (initial.feeCents / 100).toFixed(2) : "");
  const [scope, setScope] = useState<"this" | "series">(initial.scope ?? "this");
  const [conflict, setConflict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start_] = useTransition();
  const isSeries = !!initial.id && initial.recurrence && initial.recurrence !== "NONE";

  const service = services.find((s) => s.id === serviceId);
  const submit = (allowConflict: boolean) =>
    start_(async () => {
      setError(null);
      const r = await saveAppointment(
        {
          id: initial.id,
          kind,
          title,
          clientId: clientId || null,
          providerId,
          serviceId: kind === "SESSION" ? serviceId || null : null,
          modality,
          locationId: locationId || null,
          startsAt: new Date(start).toISOString(),
          durationMin: Number(duration),
          recurrence: recurrence as AppointmentInput["recurrence"],
          occurrences: Number(occurrences),
          notes,
          feeCents: fee ? Math.round(Number(fee) * 100) : null,
          scope,
        },
        allowConflict,
      );
      if (r.conflict) setConflict(r.conflict);
      else if (r.error) setError(r.error);
      else {
        toast(initial.id ? "Appointment updated" : recurrence !== "NONE" ? "Recurring appointments created" : "Appointment booked");
        onClose();
      }
    });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={initial.id ? "Edit appointment" : kind === "TIME_OFF" ? "Block time off" : "New appointment"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => submit(false)}>
            {pending && <Loader2 className="size-4 animate-spin" />} {initial.id ? "Save" : "Book"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        {conflict && (
          <Notice tone="warn" className="flex items-center justify-between gap-3">
            <span>{conflict}</span>
            <Button size="sm" variant="outline" onClick={() => submit(true)}>
              Book anyway
            </Button>
          </Notice>
        )}
        {!initial.id && (
          <div className="flex gap-1 rounded-lg bg-canvas p-1">
            {[
              ["SESSION", "Client session"],
              ["OTHER", "Other event"],
              ["TIME_OFF", "Time off"],
            ].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k as AppointmentInput["kind"])} className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", kind === k ? "bg-white shadow-sm" : "text-muted")}>
                {l}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "SESSION" ? (
            <>
              <Field label="Client" required>
                <Select
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    const c = clients.find((x) => x.id === e.target.value);
                    if (c?.defaultServiceId) {
                      setServiceId(c.defaultServiceId);
                      const s = services.find((x) => x.id === c.defaultServiceId);
                      if (s) setDuration(String(s.durationMin));
                    }
                  }}
                >
                  <option value="">Choose a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Service">
                <Select
                  value={serviceId}
                  onChange={(e) => {
                    setServiceId(e.target.value);
                    const s = services.find((x) => x.id === e.target.value);
                    if (s) {
                      setDuration(String(s.durationMin));
                      setFee((s.rateCents / 100).toFixed(2));
                    }
                  }}
                >
                  <option value="">No service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.durationMin} min{s.rateCents ? ` · ${money(s.rateCents)}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <Field label="Title" className="sm:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "TIME_OFF" ? "Time off" : "e.g. Supervision"} />
            </Field>
          )}
          <Field label="Starts">
            <Input type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Duration (minutes)">
            <Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          {kind === "SESSION" && (
            <>
              <Field label="Where">
                <Select value={modality} onChange={(e) => setModality(e.target.value as AppointmentInput["modality"])}>
                  <option value="TELEHEALTH">Telehealth</option>
                  <option value="IN_PERSON">In person</option>
                </Select>
              </Field>
              {locations.length > 0 ? (
                <Field label="Location">
                  <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    <option value="">Default</option>
                    {locations
                      .filter((l) => (modality === "TELEHEALTH" ? l.kind === "TELEHEALTH" : l.kind === "OFFICE"))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              ) : (
                <Field label="Fee">
                  <Input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder={service ? (service.rateCents / 100).toFixed(2) : "0.00"} />
                </Field>
              )}
            </>
          )}
          {providers.length > 1 && (
            <Field label="Clinician">
              <Select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {!initial.id && kind !== "TIME_OFF" && (
            <>
              <Field label="Repeats">
                <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as AppointmentInput["recurrence"] & string)}>
                  <option value="NONE">Does not repeat</option>
                  <option value="WEEKLY">Every week</option>
                  <option value="BIWEEKLY">Every 2 weeks</option>
                  <option value="MONTHLY">Every month</option>
                </Select>
              </Field>
              {recurrence !== "NONE" && (
                <Field label="Number of sessions">
                  <Input type="number" min={2} max={52} value={occurrences} onChange={(e) => setOccurrences(e.target.value)} />
                </Field>
              )}
            </>
          )}
        </div>
        {isSeries && (
          <div className="flex gap-4 rounded-lg bg-canvas px-3 py-2 text-sm">
            <span className="text-muted">Apply changes to</span>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={scope === "this"} onChange={() => setScope("this")} className="accent-brand-600" /> this appointment
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={scope === "series"} onChange={() => setScope("series")} className="accent-brand-600" /> this and following
            </label>
          </div>
        )}
        <Field label="Private notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function DetailModal({ appt: a, onClose, onEdit }: { appt: Appt; onClose: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [chargeFee, setChargeFee] = useState(false);
  const isPast = new Date(a.endsAt) < new Date();
  const setStatus = (status: string) =>
    start(async () => {
      await setAppointmentStatus(a.id, status, chargeFee);
      toast(`Marked as ${APPOINTMENT_STATUS[status as keyof typeof APPOINTMENT_STATUS].toLowerCase()}`);
      onClose();
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={a.clientName ?? a.title ?? "Event"}
      description={`${format(new Date(a.startsAt), "EEEE, MMMM d · h:mm a")} – ${time(a.endsAt)}`}
      footer={
        <>
          <Button
            variant="outline"
            className="mr-auto"
            disabled={pending}
            onClick={() => {
              const scope = a.seriesId && confirm("Delete all following appointments in this series too? (Cancel = only this one)") ? "series" : "this";
              if (scope === "this" && !confirm("Delete this appointment?")) return;
              start(async () => {
                const r = await deleteAppointment(a.id, scope);
                if (r.error) toast(r.error, "error");
                else onClose();
              });
            }}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onEdit}>
            Edit
          </Button>
          {a.kind === "SESSION" &&
            (a.sessionId ? (
              <Link href={`/sessions/${a.sessionId}`}>
                <Button>
                  <FileText className="size-4" /> Open note
                </Button>
              </Link>
            ) : a.modality === "TELEHEALTH" ? (
              <Link href={`/telehealth/room?appointment=${a.id}`}>
                <Button>
                  <Video className="size-4" /> Start call
                </Button>
              </Link>
            ) : (
              <Link href={`/capture/record?mode=IN_PERSON&appointment=${a.id}`}>
                <Button>
                  <Mic className="size-4" /> Capture session
                </Button>
              </Link>
            ))}
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge color={statusColor(a.status)}>{APPOINTMENT_STATUS[a.status as keyof typeof APPOINTMENT_STATUS] ?? a.status}</Badge>
          {a.kind === "SESSION" && (
            <Badge color="gray">
              {a.modality === "TELEHEALTH" ? <Video className="mr-1 size-3" /> : <MapPin className="mr-1 size-3" />}
              {a.modality === "TELEHEALTH" ? "Telehealth" : "In person"}
            </Badge>
          )}
          {a.seriesId && (
            <Badge color="blue">
              <Repeat className="mr-1 size-3" /> Recurring
            </Badge>
          )}
          {a.bookedOnline && <Badge color="violet">Booked online</Badge>}
        </div>
        {a.serviceName && <div>Service: {a.serviceName}</div>}
        <div>Clinician: {a.providerName}</div>
        {a.feeCents != null && <div>Fee: {money(a.feeCents)}</div>}
        {a.notes && <div className="rounded-lg bg-canvas p-3">{a.notes}</div>}
        {a.clientId && (
          <Link href={`/clients/${a.clientId}`} className="inline-block font-medium text-brand-700">
            Open client record →
          </Link>
        )}
        {a.kind === "SESSION" && (
          <div className="border-t border-line pt-3">
            <div className="mb-2 font-medium">Update status</div>
            <div className="flex flex-wrap gap-2">
              {a.status === "REQUESTED" && (
                <Button size="sm" onClick={() => setStatus("SCHEDULED")} disabled={pending}>
                  Confirm request
                </Button>
              )}
              {isPast && a.status !== "COMPLETED" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("COMPLETED")} disabled={pending}>
                  Completed
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setStatus("CANCELLED")} disabled={pending}>
                Cancelled
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("LATE_CANCEL")} disabled={pending}>
                Late cancel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("NO_SHOW")} disabled={pending}>
                No-show
              </Button>
              {a.status !== "SCHEDULED" && a.status !== "REQUESTED" && (
                <Button size="sm" variant="ghost" onClick={() => setStatus("SCHEDULED")} disabled={pending}>
                  Reset to scheduled
                </Button>
              )}
            </div>
            <Checkbox className="mt-2" label="Create a fee invoice for late cancel / no-show" checked={chargeFee} onChange={(e) => setChargeFee(e.target.checked)} />
          </div>
        )}
      </div>
    </Modal>
  );
}
