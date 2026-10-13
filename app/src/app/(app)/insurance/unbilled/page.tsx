import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnbilledClaims } from "./unbilled-claims";

export const metadata = { title: "Unbilled insurance sessions" };

export default async function InsuranceUnbilledPage() {
  const sessions = await db.session.findMany({
    where: { billingType: "INSURANCE", claimLines: { none: {} }, clientId: { not: null }, writeOff: false },
    include: { client: { include: { policies: { where: { archived: false }, include: { payer: true }, orderBy: { priority: "asc" } } } } },
    orderBy: { startedAt: "desc" },
  });
  if (!sessions.length) {
    return <Card className="p-10 text-center text-sm text-muted">No unbilled insurance sessions. Sessions for clients billed through insurance appear here once their note exists.</Card>;
  }
  const groups = new Map<string, { clientId: string; client: string; payer: string | null; sessions: { id: string; date: string; cpt: string | null; feeCents: number; title: string | null }[] }>();
  for (const s of sessions) {
    const g = groups.get(s.clientId!) ?? { clientId: s.clientId!, client: `${s.client!.firstName} ${s.client!.lastName}`, payer: s.client!.policies[0]?.payer.name ?? null, sessions: [] };
    g.sessions.push({ id: s.id, date: s.startedAt.toISOString(), cpt: s.cpt, feeCents: s.feeCents ?? 0, title: s.title });
    groups.set(s.clientId!, g);
  }
  return <UnbilledClaims groups={[...groups.values()]} />;
}
