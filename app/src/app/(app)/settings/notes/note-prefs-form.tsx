"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, Field, Input, Select, cn } from "@/components/ui";
import { MODALITIES } from "@/lib/constants";
import { SaveButton } from "../save-bar";
import { saveNotePrefs } from "../actions";

export function NotePrefsForm({ initial, defaults }: { initial: { providerTerm: string; clientTerm: string; pronouns: string; defaultModalities: string[] }; defaults: { individual: string; couple: string; clientNote: string } }) {
  const [f, setF] = useState(initial);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Note identifiers" description="Your preferred terms in generated notes." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="How notes refer to you">
            <Input value={f.providerTerm} onChange={(e) => setF({ ...f, providerTerm: e.target.value })} list="provider-terms" />
            <datalist id="provider-terms">
              {["Therapist", "Clinician", "Counselor", "Psychologist", "Writer", "Provider"].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Your pronouns">
            <Select value={f.pronouns} onChange={(e) => setF({ ...f, pronouns: e.target.value })}>
              <option value="">Not specified</option>
              <option value="she/her">She/her</option>
              <option value="he/him">He/him</option>
              <option value="they/them">They/them</option>
            </Select>
          </Field>
          <Field label="How notes refer to clients">
            <Select value={f.clientTerm} onChange={(e) => setF({ ...f, clientTerm: e.target.value })}>
              <option value="Client">Client</option>
              <option value="Patient">Patient</option>
              <option value="FIRST_NAME">Client's first name</option>
            </Select>
          </Field>
          <Field label="Default therapeutic modalities" className="sm:col-span-3" hint="Pre-selected for new clients.">
            <div className="flex flex-wrap gap-1.5">
              {MODALITIES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setF({ ...f, defaultModalities: f.defaultModalities.includes(m) ? f.defaultModalities.filter((x) => x !== m) : [...f.defaultModalities, m] })}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", f.defaultModalities.includes(m) ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line")}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton action={() => saveNotePrefs(f)} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Default templates" actions={<Link href="/templates" className="text-sm font-medium text-brand-700">Change in Note templates</Link>} />
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Individuals</dt>
            <dd className="font-medium">{defaults.individual}</dd>
          </div>
          <div>
            <dt className="text-muted">Couples & families</dt>
            <dd className="font-medium">{defaults.couple}</dd>
          </div>
          <div>
            <dt className="text-muted">Note for client</dt>
            <dd className="font-medium">{defaults.clientNote}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
