"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { recordManualEra } from "../actions";

export function ManualEra({ payers, claims }: { payers: { id: string; name: string }[]; claims: { id: string; label: string; payerId: string }[] }) {
  const [open, setOpen] = useState(false);
  const [payerId, setPayerId] = useState(payers[0]?.id ?? "");
  const [check, setCheck] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [amounts, setAmounts] = useState<Record<string, { paid: string; patient: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const payerClaims = claims.filter((c) => c.payerId === payerId);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={!payers.length}>
        <Plus className="size-4" /> Post a payer payment
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Post a payer payment"
        description="Record a check or EFT from a payer against open claims."
        footer={
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await recordManualEra({
                  payerId,
                  checkNumber: check,
                  receivedAt: when,
                  lines: Object.entries(amounts).map(([claimId, a]) => ({ claimId, paidCents: Math.round(Number(a.paid || 0) * 100), patientRespCents: Math.round(Number(a.patient || 0) * 100) })),
                });
                if (r.error) setError(r.error);
                else {
                  toast("Payment posted");
                  setOpen(false);
                  setAmounts({});
                }
              })
            }
          >
            Post payment
          </Button>
        }
      >
        <div className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Payer">
              <Select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                {payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Check / EFT #">
              <Input value={check} onChange={(e) => setCheck(e.target.value)} />
            </Field>
            <Field label="Received">
              <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          </div>
          {payerClaims.length === 0 ? (
            <p className="text-sm text-muted">No open claims for this payer.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_110px_110px] gap-2 text-xs font-semibold uppercase text-muted">
                <span>Claim</span>
                <span>Paid</span>
                <span>Patient resp.</span>
              </div>
              {payerClaims.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_110px_110px] items-center gap-2 text-sm">
                  <span className="truncate">{c.label}</span>
                  <Input type="number" step="0.01" value={amounts[c.id]?.paid ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: { paid: e.target.value, patient: a[c.id]?.patient ?? "" } }))} />
                  <Input type="number" step="0.01" value={amounts[c.id]?.patient ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: { paid: a[c.id]?.paid ?? "", patient: e.target.value } }))} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
