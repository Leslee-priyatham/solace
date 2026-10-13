"use client";

import { useState } from "react";
import { Card, Field, Input, cn } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { saveClinicalInfo } from "../actions";

const TAXONOMIES = [
  ["101YM0800X", "Counselor — Mental Health"],
  ["101YP2500X", "Counselor — Professional"],
  ["1041C0700X", "Social Worker — Clinical"],
  ["103T00000X", "Psychologist"],
  ["103TC0700X", "Psychologist — Clinical"],
  ["106H00000X", "Marriage & Family Therapist"],
  ["2084P0800X", "Psychiatry"],
  ["364SP0808X", "Clinical Nurse Specialist — Psych/Mental Health"],
  ["363LP0808X", "Nurse Practitioner — Psych/Mental Health"],
];

export function ClinicalForm({ initial }: { initial: { npi: string; taxonomy: string; taxIdType: string; taxId: string; license: string } }) {
  const [f, setF] = useState(initial);
  return (
    <Card className="max-w-3xl">
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Individual NPI (Type 1)" hint="10 digits">
          <Input value={f.npi} onChange={(e) => setF({ ...f, npi: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" />
        </Field>
        <Field label="Primary taxonomy">
          <Input value={f.taxonomy} onChange={(e) => setF({ ...f, taxonomy: e.target.value })} list="taxonomies" placeholder="Search by code or specialty" />
          <datalist id="taxonomies">
            {TAXONOMIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Tax ID type">
          <div className="flex gap-1 rounded-lg bg-canvas p-1">
            {["EIN", "SSN"].map((t) => (
              <button key={t} type="button" onClick={() => setF({ ...f, taxIdType: t })} className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", f.taxIdType === t ? "bg-white shadow-sm" : "text-muted")}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Tax ID">
          <Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} />
        </Field>
        <Field label="Therapy license & number" hint="Shown after your name when you sign notes, e.g. “LCSW #12345”." className="sm:col-span-2">
          <Input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} />
        </Field>
      </div>
      <div className="border-t border-line px-5 py-3">
        <SaveButton action={() => saveClinicalInfo(f)} />
      </div>
    </Card>
  );
}
