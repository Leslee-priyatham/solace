"use client";

import { useState, useTransition } from "react";
import { Building2, Video, Plus, Pencil } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { PLACE_OF_SERVICE } from "@/lib/constants";
import { SaveButton } from "../save-bar";
import { deleteLocation, saveBranding, saveLocation, savePracticeDetails } from "../actions";

type Practice = { name: string; displayName: string; email: string; phone: string; country: string; currency: string; timezone: string; address: string; taxId: string; brandColor: string; logoUrl: string; slug: string };
type Loc = { id: string; name: string; kind: string; address: string; placeOfService: string };
const ZONES = typeof Intl !== "undefined" && "supportedValuesOf" in Intl ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone") : ["UTC"];

export function PracticeSettings({ practice, locations }: { practice: Practice; locations: Loc[] }) {
  const [f, setF] = useState(practice);
  const [loc, setLoc] = useState<Partial<Loc> | null>(null);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Practice details" description="Included in documents prepared for clients." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Practice name" required>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Displayed name" hint="Shown in the portal, forms and telehealth.">
            <Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
          </Field>
          <Field label="Practice email">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Practice phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Country">
            <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value.toUpperCase().slice(0, 5) })} />
          </Field>
          <Field label="Currency">
            <Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {["USD", "GBP", "EUR", "CAD", "AUD", "NZD", "INR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Time zone">
            <select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} className="h-9 w-full rounded-lg border border-line px-3 text-sm">
              {ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          <Field label="Business tax ID">
            <Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} />
          </Field>
          <Field label="Business address" className="sm:col-span-2">
            <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton action={() => savePracticeDetails(f)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Branding" description="Applied to forms, telehealth, the booking page and the client portal." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Brand colour">
            <div className="flex gap-2">
              <input type="color" value={f.brandColor} onChange={(e) => setF({ ...f, brandColor: e.target.value })} className="h-9 w-12 rounded-lg border border-line" />
              <Input value={f.brandColor} onChange={(e) => setF({ ...f, brandColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Logo URL" hint="A link to your logo image (PNG or SVG).">
            <Input value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Booking page address" hint={`/book/${f.slug}`} className="sm:col-span-2">
            <Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </Field>
        </div>
        <div className="border-t border-line px-5 py-3">
          <SaveButton action={() => saveBranding({ brandColor: f.brandColor, logoUrl: f.logoUrl, slug: f.slug })} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Practice locations"
          actions={
            <Button size="sm" variant="outline" onClick={() => setLoc({ kind: "OFFICE", placeOfService: "11" })}>
              <Plus className="size-4" /> Add location
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {locations.length === 0 && <li className="px-5 py-4 text-sm text-muted">No locations yet. Add an office for in-person sessions or a telehealth location for claims.</li>}
          {locations.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              {l.kind === "OFFICE" ? <Building2 className="size-4 text-muted" /> : <Video className="size-4 text-muted" />}
              <span className="flex-1">
                <span className="font-medium">{l.name}</span> <span className="text-muted">· POS {l.placeOfService}{l.address && ` · ${l.address}`}</span>
              </span>
              <button onClick={() => setLoc(l)} className="text-muted hover:text-ink">
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {loc && <LocationModal loc={loc} onClose={() => setLoc(null)} />}
    </div>
  );
}

function LocationModal({ loc, onClose }: { loc: Partial<Loc>; onClose: () => void }) {
  const [f, setF] = useState({ name: loc.name ?? "", kind: loc.kind ?? "OFFICE", address: loc.address ?? "", placeOfService: loc.placeOfService ?? "11" });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={loc.id ? "Edit location" : "Add location"}
      footer={
        <>
          {loc.id && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await deleteLocation(loc.id!), onClose()))}>
              Delete
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveLocation({ id: loc.id, ...f });
                if (r.error) toast(r.error, "error");
                else onClose();
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, placeOfService: e.target.value === "OFFICE" ? "11" : "10" })}>
            <option value="OFFICE">Office (in person)</option>
            <option value="TELEHEALTH">Telehealth (virtual)</option>
          </Select>
        </Field>
        <Field label="Place of service">
          <Select value={f.placeOfService} onChange={(e) => setF({ ...f, placeOfService: e.target.value })}>
            {Object.entries(PLACE_OF_SERVICE).map(([k, v]) => (
              <option key={k} value={k}>
                {k} — {v}
              </option>
            ))}
          </Select>
        </Field>
        {f.kind === "OFFICE" && (
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
