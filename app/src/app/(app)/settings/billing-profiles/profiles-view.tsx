"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, IdCard } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { archiveBillingProfile, saveBillingProfile } from "../../insurance/actions";

type P = { id: string; name: string; kind: string; npi: string; taxId: string; taxonomy: string; address: string; archived: boolean };

export function ProfilesView({ profiles }: { profiles: P[] }) {
  const [editing, setEditing] = useState<P | "new" | null>(null);
  return (
    <div className="max-w-3xl space-y-4">
      {profiles.length === 0 ? (
        <Card>
          <EmptyState icon={<IdCard className="size-6" />} title="No billing profiles yet" description="Add a billing profile to file claims and run eligibility checks under it." action={<Button onClick={() => setEditing("new")}>Add profile</Button>} />
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add profile
            </Button>
          </div>
          {profiles.map((p) => (
            <Card key={p.id} className={`flex items-start gap-4 p-5 ${p.archived ? "opacity-60" : ""}`}>
              <IdCard className="mt-0.5 size-5 text-brand-600" />
              <div className="flex-1 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {p.name} <Badge>{p.kind === "GROUP" ? "Group (Type 2)" : "Individual (Type 1)"}</Badge> {p.archived && <Badge color="gray">archived</Badge>}
                </div>
                <div className="text-muted">
                  NPI {p.npi} · Tax ID {p.taxId}
                  {p.taxonomy && ` · ${p.taxonomy}`}
                </div>
                {p.address && <div className="whitespace-pre-line text-muted">{p.address}</div>}
              </div>
              <button onClick={() => setEditing(p)} className="text-muted hover:text-ink">
                <Pencil className="size-4" />
              </button>
            </Card>
          ))}
        </>
      )}
      {editing && <ProfileModal profile={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProfileModal({ profile, onClose }: { profile: P | null; onClose: () => void }) {
  const [f, setF] = useState({ name: profile?.name ?? "", kind: profile?.kind ?? "INDIVIDUAL", npi: profile?.npi ?? "", taxId: profile?.taxId ?? "", taxonomy: profile?.taxonomy ?? "", address: profile?.address ?? "" });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={profile ? "Edit billing profile" : "Add billing profile"}
      footer={
        <>
          {profile && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await archiveBillingProfile(profile.id, !profile.archived), onClose()))}>
              {profile.archived ? "Restore" : "Archive"}
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveBillingProfile({ id: profile?.id, ...f });
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
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Riverside Counseling LLC" />
        </Field>
        <Field label="Type">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="INDIVIDUAL">Individual (Type 1 NPI)</option>
            <option value="GROUP">Group (Type 2 NPI)</option>
          </Select>
        </Field>
        <Field label="NPI" required>
          <Input value={f.npi} onChange={(e) => setF({ ...f, npi: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </Field>
        <Field label="Tax ID (EIN or SSN)" required>
          <Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} />
        </Field>
        <Field label="Taxonomy code">
          <Input value={f.taxonomy} onChange={(e) => setF({ ...f, taxonomy: e.target.value })} />
        </Field>
        <Field label="Billing address" className="sm:col-span-2">
          <Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
