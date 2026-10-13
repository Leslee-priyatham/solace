"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { date, money } from "@/lib/format";
import { createClaim } from "../actions";

type Group = { clientId: string; client: string; payer: string | null; sessions: { id: string; date: string; cpt: string | null; feeCents: number; title: string | null }[] };

export function UnbilledClaims({ groups }: { groups: Group[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Record<string, string[]>>(Object.fromEntries(groups.map((g) => [g.clientId, g.sessions.map((s) => s.id)])));
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Card key={g.clientId}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
            <Link href={`/clients/${g.clientId}/billing`} className="font-semibold hover:text-brand-700">
              {g.client}
            </Link>
            {g.payer ? (
              <span className="text-sm text-muted">{g.payer}</span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-amber-700">
                <AlertTriangle className="size-4" /> No policy on file
              </span>
            )}
            <Button
              size="sm"
              className="ml-auto"
              disabled={pending || !g.payer || !selected[g.clientId]?.length}
              onClick={() =>
                start(async () => {
                  const r = await createClaim({ clientId: g.clientId, sessionIds: selected[g.clientId] });
                  if (r.error) toast(r.error, "error");
                  else router.push(`/insurance/claims/${r.id}`);
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Create claim
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {g.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={selected[g.clientId]?.includes(s.id)}
                  onChange={() =>
                    setSelected((sel) => ({ ...sel, [g.clientId]: sel[g.clientId].includes(s.id) ? sel[g.clientId].filter((x) => x !== s.id) : [...sel[g.clientId], s.id] }))
                  }
                />
                <span className="w-28 text-muted">{date(s.date)}</span>
                <Link href={`/sessions/${s.id}`} className="flex-1 truncate hover:text-brand-700">
                  {s.title ?? "Session"}
                </Link>
                <span className="text-muted">{s.cpt ?? "no code"}</span>
                <span className="w-24 text-right tabular-nums">{money(s.feeCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
