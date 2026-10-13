"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Trash2, Link2 } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { CopyButton, useToast } from "@/components/client-ui";
import { ago } from "@/lib/format";
import { SaveButton } from "../save-bar";
import { addExternalCalendar, disableIcalFeed, removeExternalCalendar, resetIcalToken, saveCalendarPrefs } from "../actions";

export function CalendarSettings({ weekStartsOn, feedUrl, calendars }: { weekStartsOn: 0 | 1; feedUrl: string | null; calendars: { id: string; name: string; color: string; events: number; lastSyncedAt: string | null }[] }) {
  const [start, setStart] = useState(weekStartsOn);
  const [f, setF] = useState({ name: "", icsUrl: "", color: "#94a3b8" });
  const [pending, run] = useTransition();
  const toast = useToast();
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Calendar settings" />
        <div className="flex items-end gap-3 p-5">
          <Field label="Start of week" className="w-60">
            <Select value={start} onChange={(e) => setStart(Number(e.target.value) as 0 | 1)}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Field>
          <SaveButton action={() => saveCalendarPrefs({ weekStartsOn: start })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Connected calendars" description="Busy times from these calendars show on your calendar and are blocked from online booking." />
        <ul className="divide-y divide-line">
          {calendars.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <span className="flex-1 font-medium">{c.name}</span>
              <span className="text-muted">
                {c.events} events{c.lastSyncedAt ? ` · synced ${ago(c.lastSyncedAt)}` : ""}
              </span>
              <button onClick={() => run(async () => void (await removeExternalCalendar(c.id)))} className="text-muted hover:text-red-600">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-3 border-t border-line p-5">
          <div className="text-sm font-medium">Add a calendar by its iCal address</div>
          <p className="text-xs text-muted">
            In Google Calendar: Settings → your calendar → “Secret address in iCal format”. In Outlook: Settings → Shared calendars → Publish → ICS link. Apple iCloud: share as public calendar.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_60px_auto]">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" />
            <Input value={f.icsUrl} onChange={(e) => setF({ ...f, icsUrl: e.target.value })} placeholder="https://…/basic.ics" />
            <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-9 w-full rounded-lg border border-line" />
            <Button
              disabled={pending || !f.icsUrl}
              onClick={() =>
                run(async () => {
                  const r = await addExternalCalendar(f);
                  if (r.error) toast(r.error, "error");
                  else {
                    setF({ name: "", icsUrl: "", color: "#94a3b8" });
                    toast("Calendar connected");
                  }
                })
              }
            >
              <CalendarPlus className="size-4" /> Connect
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Show your sessions in other calendars" description="Subscribe to this private feed from Google, Outlook or Apple Calendar. It shows times only — no client names." />
        <div className="space-y-3 p-5">
          {feedUrl ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                <Link2 className="size-4 text-muted" />
                <span className="flex-1 truncate">{feedUrl}</span>
                <CopyButton text={feedUrl} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => confirm("Create a new address? The old one stops working.") && run(async () => void (await resetIcalToken()))}>
                  Reset address
                </Button>
                <Button variant="outline" size="sm" onClick={() => run(async () => void (await disableIcalFeed()))}>
                  Turn off feed
                </Button>
              </div>
              <Notice tone="warn">Anyone with this address can see when you're busy. Keep it private.</Notice>
            </>
          ) : (
            <Button onClick={() => run(async () => void (await resetIcalToken()))} disabled={pending}>
              Turn on calendar feed
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
