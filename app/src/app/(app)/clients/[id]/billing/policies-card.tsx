"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShieldPlus, Plus, Pencil, RefreshCw, Loader2, FileBadge } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { date, money } from "@/lib/format";
import { archiveAuthorization, archivePolicy, checkEligibility, saveAuthorization, savePolicy, type PolicyInput } from "@/app/(app)/insurance/actions";

type Policy = {
  id: string;
  payerId: string;
  payer: string;
  priority: number;
  memberId: string;
  groupNumber: string | null;
  planName: string | null;
  subscriberName: string | null;
  relationship: string;
  copayCents: number | null;
  coinsurancePct: number | null;
  deductibleCents: number | null;
  eligibility: { checkedAt: string; status: string; summary: string; simulated?: boolean } | null;
};
type Auth = { id: string; authNumber: string; cpt: string | null; visitsAllowed: number | null; visitsUsed: number; startDate: string; endDate: string | null };

export function PoliciesCard({ clientId, payers, policies, authorizations }: { clientId: string; payers: { id: string; name: string }[]; policies: Policy[]; authorizations: Auth[] }) {
  const [editing, setEditing] = useState<Policy | "new" | null>(null);
  const [authEditing, setAuthEditing] = useState<Auth | "new" | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Card>
      <CardHeader
        title="Insurance"
        description="Policies, eligibility and prior authorizations."
        actions={
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add policy
          </Button>
        }
      />
      {policies.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No insurance on file. This client is billed as self-pay.</p>
      ) : (
        <ul className="divide-y divide-line">
          {policies.map((p) => (
            <li key={p.id} className="flex flex-wrap items-start gap-4 px-5 py-4">
              <ShieldPlus className="mt-0.5 size-5 text-brand-600" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {p.payer} <Badge>{p.priority === 1 ? "Primary" : "Secondary"}</Badge>
                </div>
                <div className="text-muted">
                  Member {p.memberId}
                  {p.groupNumber && ` · Group ${p.groupNumber}`}
                  {p.planName && ` · ${p.planName}`}
                </div>
                <div className="text-muted">
                  Copay {p.copayCents != null ? money(p.copayCents) : "—"} · Coinsurance {p.coinsurancePct ?? "—"}% · Deductible {p.deductibleCents != null ? money(p.deductibleCents) : "—"}
                </div>
                {p.eligibility && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge color={p.eligibility.status === "ACTIVE" ? "green" : "red"}>{p.eligibility.status.toLowerCase()}</Badge>
                    <span className="text-xs text-muted">
                      {p.eligibility.summary} Checked {date(p.eligibility.checkedAt)}
                      {p.eligibility.simulated && " (simulated)"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => (await checkEligibility(p.id), toast("Eligibility checked")))}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Eligibility
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Prior authorizations</h4>
          <button onClick={() => setAuthEditing("new")} className="text-sm font-medium text-brand-700">
            + Add
          </button>
        </div>
        {authorizations.length === 0 ? (
          <p className="text-sm text-muted">None on file.</p>
        ) : (
          <ul className="space-y-1.5">
            {authorizations.map((a) => {
              const left = a.visitsAllowed != null ? a.visitsAllowed - a.visitsUsed : null;
              return (
                <li key={a.id} className="flex items-center gap-3 text-sm">
                  <FileBadge className="size-4 text-muted" />
                  <span className="font-medium">#{a.authNumber}</span>
                  <span className="text-muted">
                    {a.cpt && `${a.cpt} · `}
                    {date(a.startDate)} – {a.endDate ? date(a.endDate) : "open"}
                  </span>
                  {left != null && <Badge color={left <= 2 ? "amber" : "gray"}>{left} visits left</Badge>}
                  <button onClick={() => setAuthEditing(a)} className="ml-auto text-muted hover:text-ink">
                    <Pencil className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {editing && <PolicyModal clientId={clientId} payers={payers} policy={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {authEditing && <AuthModal clientId={clientId} auth={authEditing === "new" ? null : authEditing} onClose={() => setAuthEditing(null)} />}
    </Card>
  );
}

function PolicyModal({ clientId, payers, policy, onClose }: { clientId: string; payers: { id: string; name: string }[]; policy: Policy | null; onClose: () => void }) {
  const [f, setF] = useState({
    payerId: policy?.payerId ?? payers[0]?.id ?? "",
    priority: String(policy?.priority ?? 1),
    memberId: policy?.memberId ?? "",
    groupNumber: policy?.groupNumber ?? "",
    planName: policy?.planName ?? "",
    subscriberName: policy?.subscriberName ?? "",
    relationship: policy?.relationship ?? "SELF",
    copay: policy?.copayCents != null ? (policy.copayCents / 100).toFixed(2) : "",
    coins: policy?.coinsurancePct?.toString() ?? "",
    deductible: policy?.deductibleCents != null ? (policy.deductibleCents / 100).toFixed(2) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cents = (v: string) => (v === "" ? null : Math.round(Number(v) * 100));
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={policy ? "Edit policy" : "Add insurance policy"}
      footer={
        <>
          {policy && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await archivePolicy(policy.id), onClose()))}>
              Remove policy
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const input: PolicyInput = {
                  id: policy?.id,
                  clientId,
                  payerId: f.payerId,
                  priority: Number(f.priority),
                  memberId: f.memberId,
                  groupNumber: f.groupNumber,
                  planName: f.planName,
                  subscriberName: f.subscriberName,
                  relationship: f.relationship,
                  copayCents: cents(f.copay),
                  coinsurancePct: f.coins === "" ? null : Number(f.coins),
                  deductibleCents: cents(f.deductible),
                };
                const r = await savePolicy(input);
                if (r.error) setError(r.error);
                else onClose();
              })
            }
          >
            Save policy
          </Button>
        </>
      }
    >
      {payers.length === 0 ? (
        <Notice tone="warn">
          Add payers first in{" "}
          <Link href="/settings/payers" className="font-medium underline">
            Settings → Payers
          </Link>
          .
        </Notice>
      ) : (
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payer">
              <Select value={f.payerId} onChange={(e) => setF({ ...f, payerId: e.target.value })}>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Order">
              <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="1">Primary</option>
                <option value="2">Secondary</option>
              </Select>
            </Field>
            <Field label="Member ID" required>
              <Input value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} />
            </Field>
            <Field label="Group number">
              <Input value={f.groupNumber} onChange={(e) => setF({ ...f, groupNumber: e.target.value })} />
            </Field>
            <Field label="Plan name">
              <Input value={f.planName} onChange={(e) => setF({ ...f, planName: e.target.value })} />
            </Field>
            <Field label="Client's relationship to subscriber">
              <Select value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
                <option value="SELF">Self</option>
                <option value="SPOUSE">Spouse</option>
                <option value="CHILD">Child</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            {f.relationship !== "SELF" && (
              <Field label="Subscriber name" className="sm:col-span-2">
                <Input value={f.subscriberName} onChange={(e) => setF({ ...f, subscriberName: e.target.value })} />
              </Field>
            )}
            <Field label="Copay">
              <Input type="number" step="0.01" value={f.copay} onChange={(e) => setF({ ...f, copay: e.target.value })} />
            </Field>
            <Field label="Coinsurance %">
              <Input type="number" value={f.coins} onChange={(e) => setF({ ...f, coins: e.target.value })} />
            </Field>
            <Field label="Deductible">
              <Input type="number" step="0.01" value={f.deductible} onChange={(e) => setF({ ...f, deductible: e.target.value })} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AuthModal({ clientId, auth, onClose }: { clientId: string; auth: Auth | null; onClose: () => void }) {
  const [f, setF] = useState({
    authNumber: auth?.authNumber ?? "",
    cpt: auth?.cpt ?? "",
    visits: auth?.visitsAllowed?.toString() ?? "",
    start: (auth?.startDate ?? new Date().toISOString()).slice(0, 10),
    end: auth?.endDate?.slice(0, 10) ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title={auth ? "Edit authorization" : "Add prior authorization"}
      footer={
        <>
          {auth && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await archiveAuthorization(auth.id), onClose()))}>
              Remove
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveAuthorization({ id: auth?.id, clientId, authNumber: f.authNumber, cpt: f.cpt, visitsAllowed: f.visits ? Number(f.visits) : null, startDate: f.start, endDate: f.end || undefined });
                if (r.error) setError(r.error);
                else onClose();
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Authorization #" required>
          <Input value={f.authNumber} onChange={(e) => setF({ ...f, authNumber: e.target.value })} />
        </Field>
        <Field label="Service code">
          <Input value={f.cpt} onChange={(e) => setF({ ...f, cpt: e.target.value })} placeholder="90837" />
        </Field>
        <Field label="Visits authorized">
          <Input type="number" value={f.visits} onChange={(e) => setF({ ...f, visits: e.target.value })} />
        </Field>
        <div />
        <Field label="Start">
          <Input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </Field>
        <Field label="End">
          <Input type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
