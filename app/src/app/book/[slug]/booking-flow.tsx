"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Clock } from "lucide-react";
import { Button, Field, Input, Notice, Select, Textarea, cn } from "@/components/ui";
import { money } from "@/lib/format";
import { bookSlot, getSlots } from "./actions";

type Service = { id: string; name: string; description: string | null; durationMin: number; rateCents: number };

export function BookingFlow({
  slug,
  portalToken,
  knownName,
  services,
  providers,
  currency,
  hidePrices,
}: {
  slug: string;
  portalToken?: string;
  knownName?: string;
  services: Service[];
  providers: { id: string; name: string }[];
  currency: string;
  hidePrices: boolean;
}) {
  const [serviceId, setServiceId] = useState(services[0].id);
  const [providerId, setProviderId] = useState(providers[0].id);
  const [weekStart, setWeekStart] = useState(startOfDay(new Date()));
  const [slots, setSlots] = useState<{ start: string; end: string }[] | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", note: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ confirmed: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setSlots(null);
    setSlot(null);
    getSlots(slug, serviceId, providerId, weekStart.toISOString()).then((s) => {
      setSlots(s);
      const first = s[0] ? startOfDay(new Date(s[0].start)) : null;
      setDay(first);
    });
  }, [slug, serviceId, providerId, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const daySlots = useMemo(() => (slots ?? []).filter((s) => day && isSameDay(new Date(s.start), day)), [slots, day]);
  const service = services.find((s) => s.id === serviceId)!;

  if (done) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-4 text-xl font-semibold">{done.confirmed ? "You're booked" : "Request sent"}</h1>
        <p className="mt-1 text-muted">
          {service.name} on {slot && format(new Date(slot), "EEEE, MMMM d 'at' h:mm a")}.{" "}
          {done.confirmed ? "You'll find it in your client portal." : "Your clinician will confirm the time shortly."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Book a session</h1>
      {knownName && <p className="mt-1 text-muted">Booking as {knownName}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.durationMin} min{!hidePrices && s.rateCents ? ` · ${money(s.rateCents, currency)}` : ""}
              </option>
            ))}
          </Select>
        </Field>
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
      </div>
      {service.description && <p className="mt-2 text-sm text-muted">{service.description}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button disabled={weekStart <= startOfDay(new Date())} onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-lg border border-line p-2 disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium">
          {format(days[0], "MMM d")} – {format(days[6], "MMM d")}
        </span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-lg border border-line p-2">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const count = (slots ?? []).filter((s) => isSameDay(new Date(s.start), d)).length;
          return (
            <button
              key={d.toISOString()}
              disabled={!count}
              onClick={() => {
                setDay(d);
                setSlot(null);
              }}
              className={cn("rounded-lg border px-1 py-2 text-center text-sm disabled:opacity-40", day && isSameDay(d, day) ? "border-brand-500 bg-brand-50" : "border-line")}
            >
              <div className="text-xs text-muted">{format(d, "EEE")}</div>
              <div className="font-semibold">{format(d, "d")}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 min-h-24">
        {slots === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted" />
          </div>
        ) : daySlots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{slots.length ? "Pick a day above." : "No openings this week — try the next week."}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {daySlots.map((s) => (
              <button key={s.start} onClick={() => setSlot(s.start)} className={cn("flex items-center justify-center gap-1 rounded-lg border py-2 text-sm", slot === s.start ? "border-brand-500 bg-brand-600 text-white" : "border-line hover:bg-canvas")}>
                <Clock className="size-3.5" /> {format(new Date(s.start), "h:mm a")}
              </button>
            ))}
          </div>
        )}
      </div>

      {slot && (
        <div className="mt-6 space-y-4 border-t border-line pt-6">
          {error && <Notice tone="error">{error}</Notice>}
          {!portalToken && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </Field>
              <Field label="Last name" required>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
          )}
          <Field label="Anything you'd like your clinician to know? (optional)">
            <Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await bookSlot(slug, { serviceId, providerId, start: slot, portalToken, ...form });
                if (r.error) setError(r.error);
                else setDone({ confirmed: !!r.confirmed });
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Book {format(new Date(slot), "EEE MMM d, h:mm a")}
          </Button>
        </div>
      )}
    </div>
  );
}
