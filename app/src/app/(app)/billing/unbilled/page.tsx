import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { UnbilledTable } from "./unbilled-table";

export const metadata = { title: "Unbilled sessions" };

export default async function UnbilledPage() {
  const sessions = await db.session.findMany({
    where: { invoiceItems: { none: {} }, claimLines: { none: {} }, billingType: "SELF_PAY", clientId: { not: null }, status: "READY", writeOff: false },
    include: { client: true, appointment: { include: { service: true } } },
    orderBy: { startedAt: "desc" },
  });
  if (!sessions.length) return <Card className="p-10 text-center text-sm text-muted">Every self-pay session has been invoiced. Insurance sessions appear under Insurance → Unbilled.</Card>;
  return (
    <UnbilledTable
      rows={sessions.map((s) => ({
        id: s.id,
        date: s.startedAt.toISOString(),
        client: `${s.client!.firstName} ${s.client!.lastName}`,
        clientId: s.clientId!,
        title: s.title,
        cpt: s.cpt,
        feeCents: s.feeCents ?? s.appointment?.service?.rateCents ?? 0,
      }))}
    />
  );
}
