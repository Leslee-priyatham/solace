"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Table, Td, Th, statusColor } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { date } from "@/lib/format";
import { deletePayer, enrollPayer, savePayer, setEnrollmentStatus } from "../../insurance/actions";

type Payer = { id: string; name: string; payerCode: string; address: string; phone: string; policies: number };

export function PayersView({ payers, profiles, enrollments }: { payers: Payer[]; profiles: { id: string; name: string }[]; enrollments: { id: string; payer: string; profile: string; status: string; submittedAt: string | null }[] }) {
  const [editing, setEditing] = useState<Payer | "new" | null>(null);
  const [enroll, setEnroll] = useState({ payerId: "", profileId: "" });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="max-w-4xl space-y-6">
      <Card>
        <CardHeader
          title="Payers"
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add payer
            </Button>
          }
        />
        {payers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Add the insurance companies your clients use. You'll need each payer's electronic payer ID from your clearinghouse list.</p>
        ) : (
          <Table className="rounded-none border-0">
            <thead>
              <tr>
                <Th>Payer</Th>
                <Th>Payer ID</Th>
                <Th>Phone</Th>
                <Th>Clients</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {payers.map((p) => (
                <tr key={p.id}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="font-mono">{p.payerCode}</Td>
                  <Td className="text-muted">{p.phone || "—"}</Td>
                  <Td>{p.policies}</Td>
                  <Td className="text-right">
                    <button onClick={() => setEditing(p)} className="mr-2 text-muted hover:text-ink">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => confirm(`Delete ${p.name}?`) && start(async () => toast((await deletePayer(p.id)).error ?? "Payer deleted"))} className="text-muted hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Payer enrollments" description="Track which billing profiles are enrolled with which payers for claims and ERAs." />
        {profiles.length === 0 || payers.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Add a billing profile and at least one payer to start an enrollment.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2 border-b border-line p-5">
            <Field label="Payer" className="w-56">
              <Select value={enroll.payerId} onChange={(e) => setEnroll({ ...enroll, payerId: e.target.value })}>
                <option value="">Choose…</option>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Billing profile" className="w-64">
              <Select value={enroll.profileId} onChange={(e) => setEnroll({ ...enroll, profileId: e.target.value })}>
                <option value="">Choose…</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button disabled={!enroll.payerId || !enroll.profileId || pending} onClick={() => start(async () => toast((await enrollPayer(enroll.payerId, enroll.profileId)).error ?? "Enrollment recorded"))}>
              Record enrollment
            </Button>
          </div>
        )}
        <ul className="divide-y divide-line">
          {enrollments.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
              <span className="flex-1">
                <span className="font-medium">{e.payer}</span> · {e.profile}
                {e.submittedAt && <span className="text-muted"> · submitted {date(e.submittedAt)}</span>}
              </span>
              <Badge color={statusColor(e.status)}>{e.status.toLowerCase()}</Badge>
              <Select value={e.status} onChange={(ev) => start(async () => void (await setEnrollmentStatus(e.id, ev.target.value)))} className="w-36">
                {["PENDING", "SUBMITTED", "APPROVED", "REJECTED"].map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase()}
                  </option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      </Card>
      {editing && <PayerModal payer={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PayerModal({ payer, onClose }: { payer: Payer | null; onClose: () => void }) {
  const [f, setF] = useState({ name: payer?.name ?? "", payerCode: payer?.payerCode ?? "", address: payer?.address ?? "", phone: payer?.phone ?? "" });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={payer ? "Edit payer" : "Add payer"}
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePayer({ id: payer?.id, ...f });
              if (r.error) toast(r.error, "error");
              else onClose();
            })
          }
        >
          Save payer
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Electronic payer ID" required>
          <Input value={f.payerCode} onChange={(e) => setF({ ...f, payerCode: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Claims address" className="sm:col-span-2">
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
