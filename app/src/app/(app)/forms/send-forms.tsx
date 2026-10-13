"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Send, Loader2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { getSendOptions, sendForms } from "./actions";

type Options = Awaited<ReturnType<typeof getSendOptions>>;

export function SendFormsButton({ clientId, defaultOpen, variant = "outline" }: { clientId?: string; defaultOpen?: boolean; variant?: "primary" | "outline" }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Send className="size-4" /> Send forms
      </Button>
      {open && <SendFormsModal clientId={clientId} onClose={() => setOpen(false)} />}
    </>
  );
}

function SendFormsModal({ clientId, onClose }: { clientId?: string; onClose: () => void }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [clientIds, setClientIds] = useState<string[]>(clientId ? [clientId] : []);
  const [formIds, setFormIds] = useState<string[]>([]);
  const [packetId, setPacketId] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    getSendOptions().then(setOpts);
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const clients = opts?.clients.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase())) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Send forms"
      description="Clients get a secure message and complete the forms in their portal."
      footer={
        <Button
          disabled={pending || !clientIds.length || (!formIds.length && !packetId)}
          onClick={() =>
            start(async () => {
              const r = await sendForms({ clientIds, formIds, packetId: packetId || undefined, message });
              if (r.error) toast(r.error, "error");
              else {
                toast(r.sent ? `Sent ${r.sent} form request${r.sent === 1 ? "" : "s"}` : "Those forms are already waiting for the client");
                onClose();
              }
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Send
        </Button>
      }
    >
      {!opts ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted" />
        </div>
      ) : opts.forms.length === 0 ? (
        <p className="text-sm text-muted">
          You don't have any practice forms yet.{" "}
          <Link href="/forms/library" className="font-medium text-brand-700">
            Add one from the library
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-5">
          {!clientId && (
            <Field label={`Clients (${clientIds.length} selected)`}>
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter clients" className="mb-2" />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-line">
                {clients.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas">
                    <input type="checkbox" className="accent-brand-600" checked={clientIds.includes(c.id)} onChange={() => toggle(clientIds, setClientIds, c.id)} />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted">{c.email}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
          {opts.packets.length > 0 && (
            <Field label="Packet">
              <Select value={packetId} onChange={(e) => setPacketId(e.target.value)}>
                <option value="">No packet</option>
                {opts.packets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.count} forms)
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={packetId ? "Additional forms" : "Forms"}>
            <div className="grid gap-2 sm:grid-cols-2">
              {opts.forms.map((f) => (
                <label key={f.id} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", formIds.includes(f.id) ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas")}>
                  <input type="checkbox" className="accent-brand-600" checked={formIds.includes(f.id)} onChange={() => toggle(formIds, setFormIds, f.id)} />
                  {f.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Message (optional)">
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please complete these before our first session." />
          </Field>
        </div>
      )}
    </Modal>
  );
}
