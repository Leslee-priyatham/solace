"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Brain, Stethoscope, Contact, Mail, Phone, Cake, MapPin, Pencil, Plus, ShieldPlus, ExternalLink, Copy, Trash2, Users, CheckCircle2, Clock } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Select } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { date } from "@/lib/format";
import { deleteContact, saveContact, updateNotePrefs } from "../actions";

type ContactRow = { id: string; name: string; relationship: string | null; email: string | null; phone: string | null; isEmergency: boolean; isParticipant: boolean };

export function ClientSidebar({
  client,
  notePrefs,
  templates,
  formsCompleted,
  consent,
}: {
  client: {
    id: string;
    kind: string;
    pronouns: string | null;
    email: string | null;
    phone: string | null;
    dob: string | null;
    address: string | null;
    modalities: string[];
    diagnoses: { code: string; description: string }[];
    tags: string[];
    provider: string | null;
    billingType: string;
    portalToken: string;
    policies: { id: string; payer: string; memberId: string; priority: number }[];
    contacts: ContactRow[];
  };
  notePrefs: { templateId?: string; clientNoteTemplateId?: string | null };
  templates: { id: string; name: string; category: string }[];
  formsCompleted: number;
  consent: { status: string; name: string; completedAt: string | null } | null;
}) {
  const toast = useToast();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [contact, setContact] = useState<ContactRow | "new" | null>(null);
  const progressTemplate = templates.find((t) => t.id === notePrefs.templateId)?.name ?? "Your default";
  const clientNoteTemplate =
    notePrefs.clientNoteTemplateId === null ? "Do not generate" : templates.find((t) => t.id === notePrefs.clientNoteTemplateId)?.name ?? "Your default";

  return (
    <aside className="space-y-4">
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Client details</h3>
        <dl className="space-y-3 text-sm">
          <Row icon={<Brain className="size-4" />} label="Modalities">
            <div className="flex flex-wrap gap-1">
              {client.modalities.length ? client.modalities.map((m) => <Badge key={m}>{m}</Badge>) : <span className="text-muted">None recorded</span>}
            </div>
          </Row>
          <Row icon={<Stethoscope className="size-4" />} label="Diagnoses">
            <div className="flex flex-wrap gap-1">
              {client.diagnoses.length ? (
                client.diagnoses.map((d) => (
                  <span key={d.code} title={d.description}>
                    <Badge>{d.code}</Badge>
                  </span>
                ))
              ) : (
                <span className="text-muted">None recorded</span>
              )}
            </div>
          </Row>
          {client.pronouns && <Row icon={<Contact className="size-4" />}>{client.pronouns}</Row>}
          {client.email && <Row icon={<Mail className="size-4" />}>{client.email}</Row>}
          {client.phone && <Row icon={<Phone className="size-4" />}>{client.phone}</Row>}
          {client.dob && <Row icon={<Cake className="size-4" />}>{date(client.dob)}</Row>}
          {client.address && <Row icon={<MapPin className="size-4" />}><span className="whitespace-pre-line">{client.address}</span></Row>}
          {client.provider && <Row icon={<Users className="size-4" />}>Clinician: {client.provider}</Row>}
        </dl>
        {client.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {client.tags.map((t) => (
              <span key={t} className="rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800">
                {t}
              </span>
            ))}
          </div>
        )}
        <Link href={`/clients/${client.id}/edit`}>
          <Button variant="outline" size="sm" className="mt-4">
            <Pencil className="size-4" /> Edit client
          </Button>
        </Link>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{client.kind === "INDIVIDUAL" ? "Contacts" : "Participants & contacts"}</h3>
          <button onClick={() => setContact("new")} className="text-muted hover:text-ink" title="Add contact">
            <Plus className="size-4" />
          </button>
        </div>
        {client.contacts.length === 0 ? (
          <p className="text-sm text-muted">No emergency contacts or participants.</p>
        ) : (
          <ul className="space-y-2">
            {client.contacts.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <div className="font-medium">
                    {c.name} {c.relationship && <span className="font-normal text-muted">· {c.relationship}</span>}
                  </div>
                  <div className="text-xs text-muted">{[c.phone, c.email].filter(Boolean).join(" · ")}</div>
                  <div className="mt-0.5 flex gap-1">
                    {c.isParticipant && <Badge color="brand">In sessions</Badge>}
                    {c.isEmergency && <Badge color="red">Emergency</Badge>}
                  </div>
                </div>
                <button onClick={() => setContact(c)} className="text-muted hover:text-ink">
                  <Pencil className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Note preferences</h3>
          <button onClick={() => setPrefsOpen(true)} className="text-sm font-medium text-brand-700">
            Change
          </button>
        </div>
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-muted">Progress note</div>
            <div className="font-medium">{progressTemplate}</div>
          </div>
          <div>
            <div className="text-muted">Note for client</div>
            <div className="font-medium">{clientNoteTemplate}</div>
          </div>
          <p className="text-xs text-muted">These are generated automatically after each session.</p>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Consent & forms</h3>
        {consent ? (
          <div className="flex items-center gap-2 text-sm">
            {consent.status === "COMPLETED" ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Clock className="size-4 text-amber-600" />}
            {consent.name}: {consent.status === "COMPLETED" ? `signed ${date(consent.completedAt)}` : "awaiting signature"}
          </div>
        ) : (
          <p className="text-sm text-muted">No consent form sent yet.</p>
        )}
        <p className="mt-1 text-sm text-muted">{formsCompleted} completed form{formsCompleted === 1 ? "" : "s"}</p>
        <Link href={`/clients/${client.id}/forms?send=1`} className="mt-3 inline-block text-sm font-medium text-brand-700">
          Send forms →
        </Link>
      </Card>

      {client.billingType === "INSURANCE" || client.policies.length > 0 ? (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Insurance</h3>
            <Link href={`/clients/${client.id}/billing`} className="text-sm font-medium text-brand-700">
              Manage
            </Link>
          </div>
          {client.policies.length === 0 ? (
            <p className="text-sm text-muted">No insurance policy on file.</p>
          ) : (
            client.policies.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <ShieldPlus className="size-4 text-muted" />
                <span className="font-medium">{p.payer}</span>
                <span className="text-muted">· {p.memberId}</span>
                {p.priority > 1 && <Badge>secondary</Badge>}
              </div>
            ))
          )}
        </Card>
      ) : null}

      <Card className="p-5">
        <h3 className="mb-2 font-semibold">Client portal</h3>
        <p className="text-sm text-muted">Where this client completes forms, books sessions, pays invoices and messages you.</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(`${location.origin}/portal/${client.portalToken}`);
              toast("Portal link copied");
            }}
          >
            <Copy className="size-4" /> Copy link
          </Button>
          <a href={`/portal/${client.portalToken}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="size-4" /> Preview
            </Button>
          </a>
        </div>
      </Card>

      {prefsOpen && <PrefsModal clientId={client.id} prefs={notePrefs} templates={templates} onClose={() => setPrefsOpen(false)} />}
      {contact && <ContactModal clientId={client.id} contact={contact === "new" ? null : contact} onClose={() => setContact(null)} />}
    </aside>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        {label && <dt className="mb-1 text-muted">{label}</dt>}
        <dd>{children}</dd>
      </div>
    </div>
  );
}

function PrefsModal({ clientId, prefs, templates, onClose }: { clientId: string; prefs: { templateId?: string; clientNoteTemplateId?: string | null }; templates: { id: string; name: string; category: string }[]; onClose: () => void }) {
  const [templateId, setTemplateId] = useState(prefs.templateId ?? "");
  const [clientNote, setClientNote] = useState(prefs.clientNoteTemplateId === null ? "NONE" : prefs.clientNoteTemplateId ?? "");
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Note preferences for this client"
      description="Overrides your defaults for this client's sessions."
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await updateNotePrefs(clientId, { templateId: templateId || undefined, clientNoteTemplateId: clientNote === "NONE" ? null : clientNote || undefined });
              onClose();
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Progress note template">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Use my default</option>
            {templates
              .filter((t) => t.category !== "CLIENT_NOTE")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Note for client">
          <Select value={clientNote} onChange={(e) => setClientNote(e.target.value)}>
            <option value="">Use my default</option>
            <option value="NONE">Do not generate</option>
            {templates
              .filter((t) => t.category === "CLIENT_NOTE")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

function ContactModal({ clientId, contact, onClose }: { clientId: string; contact: ContactRow | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: contact?.name ?? "",
    relationship: contact?.relationship ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    isEmergency: contact?.isEmergency ?? false,
    isParticipant: contact?.isParticipant ?? false,
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={contact ? "Edit contact" : "Add contact"}
      footer={
        <>
          {contact && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await deleteContact(clientId, contact.id), onClose()))}>
              <Trash2 className="size-4 text-red-600" /> Remove
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveContact(clientId, { id: contact?.id, ...f });
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
        <Field label="Name" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Relationship">
          <Input value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })} placeholder="Partner, parent, sibling…" />
        </Field>
        <Field label="Email">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Checkbox label="Takes part in sessions (couple / family)" checked={f.isParticipant} onChange={(e) => setF({ ...f, isParticipant: e.target.checked })} />
        <Checkbox label="Emergency contact" checked={f.isEmergency} onChange={(e) => setF({ ...f, isEmergency: e.target.checked })} />
      </div>
    </Modal>
  );
}
