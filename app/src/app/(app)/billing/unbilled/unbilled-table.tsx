"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Table, Td, Th } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { date, money } from "@/lib/format";
import { invoiceUnbilled } from "../actions";

type Row = { id: string; date: string; client: string; clientId: string; title: string | null; cpt: string | null; feeCents: number };

export function UnbilledTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<string[]>(rows.map((r) => r.id));
  const [pending, start] = useTransition();
  const toast = useToast();
  const total = rows.filter((r) => selected.includes(r.id)).reduce((n, r) => n + r.feeCents, 0);
  const run = (send: boolean) =>
    start(async () => {
      await invoiceUnbilled(selected, send);
      toast(send ? "Invoices created and sent" : "Draft invoices created");
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">
          {selected.length} selected · {money(total)}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={!selected.length || pending} onClick={() => run(false)}>
            {pending && <Loader2 className="size-4 animate-spin" />} Create drafts
          </Button>
          <Button disabled={!selected.length || pending} onClick={() => run(true)}>
            Create & send invoices
          </Button>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>
              <input type="checkbox" className="accent-brand-600" checked={selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
            </Th>
            <Th>Date</Th>
            <Th>Client</Th>
            <Th>Session</Th>
            <Th>Code</Th>
            <Th className="text-right">Fee</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td>
                <input type="checkbox" className="accent-brand-600" checked={selected.includes(r.id)} onChange={() => setSelected((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} />
              </Td>
              <Td className="text-muted">{date(r.date)}</Td>
              <Td>
                <Link href={`/clients/${r.clientId}`} className="font-medium hover:text-brand-700">
                  {r.client}
                </Link>
              </Td>
              <Td>
                <Link href={`/sessions/${r.id}`} className="hover:text-brand-700">
                  {r.title ?? "Session"}
                </Link>
              </Td>
              <Td className="text-muted">{r.cpt ?? "—"}</Td>
              <Td className="text-right tabular-nums">{money(r.feeCents)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
