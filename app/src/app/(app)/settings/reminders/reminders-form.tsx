"use client";

import { useState } from "react";
import { Card, CardHeader, Checkbox, Field, Notice, Select } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { saveReminderSettings } from "../actions";

const HOURS = [1, 2, 4, 12, 24, 48, 72];

export function RemindersForm({ initial }: { initial: { enabled: boolean; channels: string[]; first: number; second: number | null; formReminderDays: number | null } }) {
  const [f, setF] = useState(initial);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Session reminders" description="Applies to all clinicians in the practice. Clients can opt out individually." />
        <div className="space-y-4 p-5">
          <Checkbox label="Send session reminders" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First reminder">
              <Select value={f.first} disabled={!f.enabled} onChange={(e) => setF({ ...f, first: Number(e.target.value) })}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h === 1 ? "" : "s"} before
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Second reminder">
              <Select value={f.second ?? ""} disabled={!f.enabled} onChange={(e) => setF({ ...f, second: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>
                {HOURS.filter((h) => h < f.first).map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h === 1 ? "" : "s"} before
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Notice tone="info">
            Reminders are delivered as secure messages in the client portal. Email or SMS delivery needs an email/SMS provider, which isn't connected in this installation.
          </Notice>
          <SaveButton action={() => saveReminderSettings(f)} />
        </div>
      </Card>
    </div>
  );
}
