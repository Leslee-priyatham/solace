"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal } from "@/components/client-ui";
import { createSuperbill } from "../actions";

export function NewSuperbill({ clients, clientId: fixed }: { clients: { id: string; name: string }[]; clientId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(fixed ?? "");
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New superbill
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a superbill"
        footer={
          <Button
            disabled={pending || !clientId}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createSuperbill({ clientId, from, to });
                if (r.error) setError(r.error);
                else router.push(`/billing/superbills/${r.id}`);
              })
            }
          >
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          {!fixed && (
            <Field label="Client">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
