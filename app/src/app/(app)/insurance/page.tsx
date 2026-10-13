import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ShieldPlus } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, EmptyState, Stat, Table, Td, Th, cn, statusColor } from "@/components/ui";
import { CLAIM_STATUS } from "@/lib/constants";
import { date, money } from "@/lib/format";

export const metadata = { title: "Claims" };

const FILTERS = [
  ["open", "Open"],
  ["DRAFT", "Drafts"],
  ["SUBMITTED", "Submitted"],
  ["REJECTED", "Rejected / denied"],
  ["PAID", "Paid"],
  ["all", "All"],
] as const;

export default async function ClaimsPage({ searchParams }: { searchParams: Promise<{ status?: string; client?: string }> }) {
  const { status = "open", client } = await searchParams;
  const where: Prisma.ClaimWhereInput = {};
  if (status === "open") where.status = { in: ["DRAFT", "READY", "SUBMITTED", "ACCEPTED", "PARTIAL"] };
  else if (status === "REJECTED") where.status = { in: ["REJECTED", "DENIED"] };
  else if (status !== "all") where.status = status;
  if (client) where.clientId = client;
  const [claims, agg, count] = await Promise.all([
    db.claim.findMany({ where, include: { client: true, policy: { include: { payer: true } } }, orderBy: { createdAt: "desc" } }),
    db.claim.groupBy({ by: ["status"], _sum: { totalCents: true, paidCents: true }, _count: true }),
    db.claim.count(),
  ]);
  const sum = (statuses: string[], k: "totalCents" | "paidCents") => agg.filter((a) => statuses.includes(a.status)).reduce((n, a) => n + (a._sum[k] ?? 0), 0);

  if (count === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldPlus className="size-6" />}
          title="Bill insurance from your sessions"
          description="Add payers and a billing profile, record your clients' policies, then turn insurance sessions into claims."
          action={
            <div className="flex gap-2">
              <ButtonLink href="/settings/payers" variant="outline">
                Set up payers
              </ButtonLink>
              <ButtonLink href="/insurance/unbilled">See unbilled sessions</ButtonLink>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Awaiting payment" value={money(sum(["SUBMITTED", "ACCEPTED"], "totalCents"))} />
        <Stat label="Needs attention" value={agg.filter((a) => ["REJECTED", "DENIED"].includes(a.status)).reduce((n, a) => n + a._count, 0)} hint="Rejected or denied" />
        <Stat label="Collected from payers" value={money(sum(["PAID", "PARTIAL"], "paidCents"))} />
      </div>
      <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/insurance?status=${k}${client ? `&client=${client}` : ""}`} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", status === k ? "bg-brand-50 text-brand-800" : "text-muted")}>
            {l}
          </Link>
        ))}
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Claim</Th>
            <Th>Client</Th>
            <Th>Payer</Th>
            <Th>Created</Th>
            <Th className="text-right">Billed</Th>
            <Th className="text-right">Paid</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {claims.length === 0 && (
            <tr>
              <Td colSpan={7} className="py-10 text-center text-muted">
                No claims here.
              </Td>
            </tr>
          )}
          {claims.map((c) => (
            <tr key={c.id} className="hover:bg-canvas/60">
              <Td>
                <Link href={`/insurance/claims/${c.id}`} className="font-medium hover:text-brand-700">
                  {c.number}
                </Link>
              </Td>
              <Td>
                {c.client.firstName} {c.client.lastName}
              </Td>
              <Td className="text-muted">{c.policy.payer.name}</Td>
              <Td className="text-muted">{date(c.createdAt)}</Td>
              <Td className="text-right tabular-nums">{money(c.totalCents)}</Td>
              <Td className="text-right tabular-nums">{c.paidCents ? money(c.paidCents) : "—"}</Td>
              <Td>
                <Badge color={statusColor(c.status)}>{CLAIM_STATUS[c.status as keyof typeof CLAIM_STATUS]}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
