"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select, Textarea, cn } from "@/components/ui";
import { date, money } from "@/lib/format";
import { CPT_CODES } from "@/lib/constants";
import { createInvoice, updateInvoiceLines } from "../actions";
import { uninvoicedSessions } from "./uninvoiced";

type Line = { key: string; description: string; cpt: string; date: string; quantity: number; unit: string; sessionId?: string | null };
type Uninvoiced = Awaited<ReturnType<typeof uninvoicedSessions>>[number];
const k = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceEditor({
  clients,
  services,
  initialClientId,
  preselectSessionId,
  existing,
}: {
  clients: { id: string; name: string }[];
  services: { id: string; name: string; cpt: string | null; rateCents: number }[];
  initialClientId?: string;
  preselectSessionId?: string;
  existing?: { id: string; clientId: string; issueDate: string; dueDate: string | null; notes: string | null; lines: Omit<Line, "key">[] };
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(existing?.clientId ?? initialClientId ?? "");
  const [issueDate, setIssueDate] = useState(existing?.issueDate.slice(0, 10) ?? today());
  const [dueDate, setDueDate] = useState(existing?.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(existing?.lines.map((l) => ({ ...l, key: k() })) ?? []);
  const [sessions, setSessions] = useState<Uninvoiced[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!clientId || existing) return;
    uninvoicedSessions(clientId).then((s) => {
      setSessions(s);
      if (preselectSessionId) {
        const pre = s.find((x) => x.id === preselectSessionId);
        if (pre) setLines([sessionLine(pre)]);
      }
    });
  }, [clientId, existing, preselectSessionId]);

  const sessionLine = (s: Uninvoiced): Line => ({ key: k(), description: s.description, cpt: s.cpt ?? "", date: s.date.slice(0, 10), quantity: 1, unit: (s.feeCents / 100).toFixed(2), sessionId: s.id });
  const total = lines.reduce((n, l) => n + Math.round(Number(l.unit || 0) * 100) * l.quantity, 0);
  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const payload = () => ({
    issueDate: new Date(issueDate).toISOString(),
    dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    notes,
    lines: lines.map((l) => ({ description: l.description, cpt: l.cpt || null, date: new Date(l.date).toISOString(), quantity: l.quantity, unitCents: Math.round(Number(l.unit || 0) * 100), sessionId: l.sessionId ?? null })),
  });

  const save = (send: boolean) =>
    start(async () => {
      setError(null);
      if (existing) {
        const r = await updateInvoiceLines(existing.id, payload());
        if (r.error) return setError(r.error);
        router.push(`/billing/invoices/${existing.id}`);
        router.refresh();
      } else {
        const r = await createInvoice({ clientId, send, ...payload() });
        if (r.error) return setError(r.error);
        router.push(`/billing/invoices/${r.id}`);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        <Card className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Client" required>
            <Select value={clientId} onChange={(e) => (setClientId(e.target.value), setLines([]))} disabled={!!existing}>
              <option value="">Choose a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date">
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label="Due date" hint="Defaults to your billing settings.">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </Card>

        <Card>
          <div className="grid grid-cols-[110px_1fr_110px_70px_110px_32px] gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <span>Date</span>
            <span>Description</span>
            <span>Code</span>
            <span>Qty</span>
            <span>Price</span>
            <span />
          </div>
          {lines.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">Add sessions from the right, or a custom line.</p>}
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[110px_1fr_110px_70px_110px_32px] items-center gap-2 border-b border-line px-4 py-2">
              <Input type="date" value={l.date} onChange={(e) => patch(l.key, { date: e.target.value })} className="px-2" />
              <Input value={l.description} onChange={(e) => patch(l.key, { description: e.target.value })} />
              <Input value={l.cpt} onChange={(e) => patch(l.key, { cpt: e.target.value })} list="cpt-codes" />
              <Input type="number" min={1} value={l.quantity} onChange={(e) => patch(l.key, { quantity: Math.max(1, Number(e.target.value)) })} />
              <Input type="number" step="0.01" value={l.unit} onChange={(e) => patch(l.key, { unit: e.target.value })} />
              <button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-muted hover:text-red-600">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <datalist id="cpt-codes">
            {CPT_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { key: k(), description: "", cpt: "", date: today(), quantity: 1, unit: "0.00" }])}>
              <Plus className="size-4" /> Custom line
            </Button>
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => setLines((ls) => [...ls, { key: k(), description: s.name, cpt: s.cpt ?? "", date: today(), quantity: 1, unit: (s.rateCents / 100).toFixed(2) }])}
                className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-canvas"
              >
                + {s.name}
              </button>
            ))}
            <div className="ml-auto text-lg font-semibold tabular-nums">Total {money(total)}</div>
          </div>
        </Card>
        <Card className="p-5">
          <Field label="Notes on the invoice">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Thank you! Payment by bank transfer to …" />
          </Field>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending || !clientId} onClick={() => save(false)}>
            {pending && <Loader2 className="size-4 animate-spin" />} {existing ? "Save draft" : "Save as draft"}
          </Button>
          {!existing && (
            <Button disabled={pending || !clientId} onClick={() => save(true)}>
              Create & send
            </Button>
          )}
        </div>
      </div>

      {!existing && (
        <Card className="h-fit p-5">
          <h3 className="font-semibold">Uninvoiced sessions</h3>
          {!clientId ? (
            <p className="mt-2 text-sm text-muted">Choose a client to see their sessions.</p>
          ) : sessions.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Everything has been invoiced.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sessions.map((s) => {
                const added = lines.some((l) => l.sessionId === s.id);
                return (
                  <button
                    key={s.id}
                    disabled={added}
                    onClick={() => setLines((ls) => [...ls, sessionLine(s)])}
                    className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm", added ? "border-brand-300 bg-brand-50" : "border-line hover:bg-canvas")}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{date(s.date)}</span>
                      <span className="tabular-nums">{money(s.feeCents)}</span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {s.cpt ? `${s.cpt} · ` : ""}
                      {s.title ?? s.description}
                      {s.billingType === "INSURANCE" ? " · insurance" : ""}
                    </div>
                  </button>
                );
              })}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLines((ls) => [...ls, ...sessions.filter((s) => !ls.some((l) => l.sessionId === s.id)).map(sessionLine)])}>
                Add all
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
