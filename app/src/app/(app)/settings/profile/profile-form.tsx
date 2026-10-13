"use client";

import { useState } from "react";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { changePassword, saveProfile } from "../actions";

const ZONES = typeof Intl !== "undefined" && "supportedValuesOf" in Intl ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone") : ["UTC"];

export function ProfileForm({ user }: { user: { firstName: string; middleName: string; lastName: string; suffix: string; email: string; phone: string; timezone: string; role: string } }) {
  const [f, setF] = useState(user);
  const [pw, setPw] = useState({ current: "", next: "" });
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Personal details" actions={<Badge color="brand">{user.role.toLowerCase()}</Badge>} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="First name" required>
            <Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Middle name">
            <Input value={f.middleName} onChange={(e) => setF({ ...f, middleName: e.target.value })} />
          </Field>
          <Field label="Last name" required>
            <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Suffix / credentials" hint="e.g. LCSW, PhD">
            <Input value={f.suffix} onChange={(e) => setF({ ...f, suffix: e.target.value })} />
          </Field>
          <Field label="Email address" hint="Used to log in. Ask an admin to change it.">
            <Input value={f.email} disabled />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Time zone" className="sm:col-span-2">
            <div className="flex gap-2">
              <select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} className="h-9 flex-1 rounded-lg border border-line px-3 text-sm">
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => setF({ ...f, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
                Use my current location
              </Button>
            </div>
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton action={() => saveProfile(f)} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Password" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Current password">
            <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton
            label="Change password"
            disabled={!pw.current || !pw.next}
            action={async () => {
              const r = await changePassword(pw.current, pw.next);
              if (!r.error) setPw({ current: "", next: "" });
              return r;
            }}
          />
        </div>
      </Card>
    </div>
  );
}
