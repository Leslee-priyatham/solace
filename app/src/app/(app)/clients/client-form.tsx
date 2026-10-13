"use client";

import { useActionState, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select, Textarea, cn } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";
import { MODALITIES } from "@/lib/constants";
import { ICD10 } from "@/lib/library";

type Initial = {
  kind?: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  pronouns?: string | null;
  gender?: string | null;
  address?: string | null;
  status?: string;
  providerId?: string | null;
  billingType?: string;
  defaultServiceId?: string | null;
  notes?: string | null;
  modalities?: string[];
  diagnoses?: { code: string; description: string }[];
  tags?: string[];
};

export function ClientForm({
  action,
  initial = {},
  providers,
  services,
  allTags,
  submitLabel,
}: {
  action: (state: { error?: string } | undefined, form: FormData) => Promise<{ error?: string } | undefined>;
  initial?: Initial;
  providers: { id: string; name: string }[];
  services: { id: string; name: string }[];
  allTags: string[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState(initial.kind ?? "INDIVIDUAL");
  const [modalities, setModalities] = useState<string[]>(initial.modalities ?? []);
  const [diagnoses, setDiagnoses] = useState(initial.diagnoses ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [dxQuery, setDxQuery] = useState("");
  const [tagInput, setTagInput] = useState("");

  const dxMatches = useMemo(() => {
    const q = dxQuery.trim().toLowerCase();
    if (!q) return [];
    return ICD10.filter(([code, desc]) => code.toLowerCase().startsWith(q) || desc.toLowerCase().includes(q)).slice(0, 8);
  }, [dxQuery]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="kind" value={kind} />
      {modalities.map((m) => (
        <input key={m} type="hidden" name="modalities" value={m} />
      ))}
      {diagnoses.map((d) => (
        <input key={d.code} type="hidden" name="diagnoses" value={`${d.code}|${d.description}`} />
      ))}
      {tags.map((t) => (
        <input key={t} type="hidden" name="tags" value={t} />
      ))}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Client</h2>
        <div className="flex gap-1 rounded-lg bg-canvas p-1">
          {[
            ["INDIVIDUAL", "Individual"],
            ["COUPLE", "Couple"],
            ["FAMILY", "Family"],
          ].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", kind === k ? "bg-white shadow-sm" : "text-muted")}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" required>
            <Input name="firstName" defaultValue={initial.firstName} required />
          </Field>
          <Field label="Last name" required>
            <Input name="lastName" defaultValue={initial.lastName} required />
          </Field>
          <Field label="Preferred name">
            <Input name="preferredName" defaultValue={initial.preferredName ?? ""} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={initial.email ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" defaultValue={initial.phone ?? ""} />
          </Field>
          <Field label="Date of birth">
            <Input name="dob" type="date" defaultValue={initial.dob ?? ""} />
          </Field>
          <Field label="Pronouns">
            <Input name="pronouns" defaultValue={initial.pronouns ?? ""} placeholder="she/her, he/him, they/them…" list="pronoun-options" />
            <datalist id="pronoun-options">
              <option value="she/her" />
              <option value="he/him" />
              <option value="they/them" />
            </datalist>
          </Field>
          <Field label="Gender identity">
            <Input name="gender" defaultValue={initial.gender ?? ""} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={initial.status ?? "ACTIVE"}>
              <option value="ACTIVE">Active</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCHARGED">Discharged</option>
            </Select>
          </Field>
        </div>
        <Field label="Address">
          <Textarea name="address" rows={2} defaultValue={initial.address ?? ""} />
        </Field>
        {kind !== "INDIVIDUAL" && !initial.firstName && (
          <div className="grid gap-4 rounded-lg bg-canvas p-4 sm:grid-cols-2">
            <Field label={kind === "COUPLE" ? "Partner's name" : "Family member's name"}>
              <Input name="partnerName" />
            </Field>
            <Field label="Their email">
              <Input name="partnerEmail" type="email" />
            </Field>
            <p className="text-xs text-muted sm:col-span-2">You can add more participants from the client's profile.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Clinical</h2>
        <Field label="Therapeutic modalities">
          <div className="flex flex-wrap gap-1.5">
            {MODALITIES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModalities((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
                className={cn("rounded-full border px-2.5 py-1 text-xs", modalities.includes(m) ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line hover:bg-canvas")}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Diagnoses (ICD-10)">
          <div className="space-y-2">
            {diagnoses.map((d) => (
              <div key={d.code} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                <span className="font-mono font-medium">{d.code}</span>
                <span className="flex-1 truncate text-muted">{d.description}</span>
                <button type="button" onClick={() => setDiagnoses((s) => s.filter((x) => x.code !== d.code))} className="text-muted hover:text-red-600">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <div className="relative">
              <Input
                value={dxQuery}
                onChange={(e) => setDxQuery(e.target.value)}
                placeholder="Search by code or description, e.g. F41.1 or anxiety"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const m = dxQuery.match(/^([A-Z]\d{2}(?:\.[0-9A-Z]{1,4})?)\s*(.*)$/i);
                    if (m && !dxMatches.length) {
                      setDiagnoses((s) => [...s, { code: m[1].toUpperCase(), description: m[2] || m[1].toUpperCase() }]);
                      setDxQuery("");
                    }
                  }
                }}
              />
              {dxMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-white py-1 shadow-lg">
                  {dxMatches.map(([code, desc]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        if (!diagnoses.some((d) => d.code === code)) setDiagnoses((s) => [...s, { code, description: desc }]);
                        setDxQuery("");
                      }}
                      className="flex w-full gap-3 px-3 py-1.5 text-left text-sm hover:bg-canvas"
                    >
                      <span className="w-16 shrink-0 font-mono font-medium">{code}</span>
                      <span className="truncate">{desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted">Not in the list? Type the code and description and press Enter.</p>
          </div>
        </Field>
        <Field label="Clinician notes" hint="Private background shown to the assistant for context. Not part of any note.">
          <Textarea name="notes" rows={3} defaultValue={initial.notes ?? ""} />
        </Field>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Practice</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Primary clinician">
            <Select name="providerId" defaultValue={initial.providerId ?? ""}>
              <option value="">Me</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing">
            <Select name="billingType" defaultValue={initial.billingType ?? "SELF_PAY"}>
              <option value="SELF_PAY">Self-pay</option>
              <option value="INSURANCE">Insurance</option>
            </Select>
          </Field>
          <Field label="Default service">
            <Select name="defaultServiceId" defaultValue={initial.defaultServiceId ?? ""}>
              <option value="">None</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line px-2 py-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-800">
                {t}
                <button type="button" onClick={() => setTags((s) => s.filter((x) => x !== t))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              list="all-tags"
              placeholder={tags.length ? "" : "Type a tag and press Enter"}
              className="min-w-32 flex-1 bg-transparent text-sm outline-none"
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                  e.preventDefault();
                  const t = tagInput.trim();
                  if (!tags.includes(t)) setTags((s) => [...s, t]);
                  setTagInput("");
                }
              }}
            />
            <datalist id="all-tags">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </Field>
      </Card>

      <div className="flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
