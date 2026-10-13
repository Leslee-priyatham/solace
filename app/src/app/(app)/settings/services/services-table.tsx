"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Table, Td, Th, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { CPT_CODES } from "@/lib/constants";
import { money } from "@/lib/format";
import { archiveService, saveService } from "../actions";

type Svc = { id: string; name: string; cpt: string; description: string; durationMin: number; rateCents: number; selfSchedule: boolean; archived: boolean };

export function ServicesTable({ services }: { services: Svc[] }) {
  const [editing, setEditing] = useState<Svc | "new" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> New service
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Name</Th>
            <Th>Duration</Th>
            <Th className="text-right">Rate</Th>
            <Th>Self-schedule</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className={s.archived ? "opacity-50" : ""}>
              <Td className="font-mono">{s.cpt || "—"}</Td>
              <Td className="font-medium">
                {s.name} {s.archived && <Badge>archived</Badge>}
              </Td>
              <Td>{s.durationMin} min</Td>
              <Td className="text-right tabular-nums">{money(s.rateCents)}</Td>
              <Td>{s.selfSchedule ? <Badge color="green">On</Badge> : <Badge>Off</Badge>}</Td>
              <Td className="text-right">
                <button onClick={() => setEditing(s)} className="text-muted hover:text-ink">
                  <Pencil className="size-4" />
                </button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {editing && <ServiceModal service={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ServiceModal({ service, onClose }: { service: Svc | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: service?.name ?? "",
    cpt: service?.cpt ?? "",
    description: service?.description ?? "",
    durationMin: String(service?.durationMin ?? 50),
    rate: service ? (service.rateCents / 100).toFixed(2) : "",
    selfSchedule: service?.selfSchedule ?? false,
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      title={service ? "Edit service" : "New service"}
      footer={
        <>
          {service && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await archiveService(service.id, !service.archived), onClose()))}>
              {service.archived ? "Restore" : "Archive"}
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveService({ id: service?.id, name: f.name, cpt: f.cpt, description: f.description, durationMin: Number(f.durationMin), rateCents: Math.round(Number(f.rate || 0) * 100), selfSchedule: f.selfSchedule });
                if (r.error) toast(r.error, "error");
                else onClose();
              })
            }
          >
            Save service
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Service code (CPT)">
          <Input
            value={f.cpt}
            list="svc-cpt"
            onChange={(e) => {
              const code = CPT_CODES.find((c) => c.code === e.target.value);
              setF({ ...f, cpt: e.target.value, ...(code?.minutes && !service ? { durationMin: String(code.minutes) } : {}), ...(code && !f.name ? { name: code.label } : {}) });
            }}
          />
          <datalist id="svc-cpt">
            {CPT_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" min={5} step={5} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
        </Field>
        <Field label="Base rate">
          <Input type="number" step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox label="Clients can book this online" checked={f.selfSchedule} onChange={(e) => setF({ ...f, selfSchedule: e.target.checked })} />
        </div>
        <Field label="Description (shown on the booking page)" className="sm:col-span-2">
          <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
