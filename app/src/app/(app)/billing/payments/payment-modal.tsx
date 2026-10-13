"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { PAYMENT_METHOD } from "@/lib/constants";
import { recordPayment } from "../actions";

export function PaymentForm({
  clients,
  clientId: fixedClient,
  invoiceId,
  defaultAmountCents,
  onDone,
}: {
  clients?: { id: string; name: string }[];
  clientId?: string;
  invoiceId?: string;
  defaultAmountCents?: number;
  onDone: () => void;
}) {
  const [clientId, setClientId] = useState(fixedClient ?? "");
  const [amount, setAmount] = useState(defaultAmountCents ? (defaultAmountCents / 100).toFixed(2) : "");
  const [method, setMethod] = useState("CARD");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-4">
      {error && <Notice tone="error">{error}</Notice>}
      {!fixedClient && clients && (
        <Field label="Client" required>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(PAYMENT_METHOD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date received">
          <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Reference" hint="Check #, transaction ID…">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="text-xs text-muted">{invoiceId ? "Applied to this invoice first; any extra goes to other open invoices, then stays as credit." : "Applied to the client's open invoices, oldest first. Anything left over stays as credit."}</p>
      <div className="flex justify-end">
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await recordPayment({ clientId, amountCents: Math.round(Number(amount) * 100), method, receivedAt: new Date(when).toISOString(), reference, notes, invoiceId });
              if (r.error) setError(r.error);
              else {
                toast("Payment recorded");
                onDone();
              }
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Record payment
        </Button>
      </div>
    </div>
  );
}

export function PaymentModal(props: { clientId: string; invoiceId?: string; defaultAmountCents?: number; onClose: () => void }) {
  return (
    <Modal open onClose={props.onClose} title="Record a payment">
      <PaymentForm clientId={props.clientId} invoiceId={props.invoiceId} defaultAmountCents={props.defaultAmountCents} onDone={props.onClose} />
    </Modal>
  );
}
