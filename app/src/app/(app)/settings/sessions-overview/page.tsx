import Link from "next/link";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink, Card, PageHeader, Stat, Table, Td, Th } from "@/components/ui";
import { date, duration } from "@/lib/format";
import { CAPTURE_MODE } from "@/lib/constants";
import { BarChartCard } from "@/components/charts";

export const metadata = { title: "Sessions overview" };

export default async function SessionsOverviewPage({ searchParams }: { searchParams: Promise<{ month?: string; provider?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month ? new Date(`${sp.month}-01T12:00:00`) : new Date();
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const where = { startedAt: { gte: from, lte: to }, ...(sp.provider ? { providerId: sp.provider } : {}) };
  const [sessions, providers] = await Promise.all([
    db.session.findMany({ where, include: { client: true, provider: true, documents: { select: { status: true } } }, orderBy: { startedAt: "desc" } }),
    db.user.findMany({ where: { role: { not: "BILLER" } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const days = Array.from({ length: to.getDate() }, (_, i) => i + 1).map((d) => ({ label: String(d), Sessions: sessions.filter((s) => s.startedAt.getDate() === d).length }));
  const byProvider = providers.map((p) => ({ name: `${p.firstName} ${p.lastName}`, count: sessions.filter((s) => s.providerId === p.id).length }));
  const ym = format(month, "yyyy-MM");
  const nav = (m: Date) => `/settings/sessions-overview?month=${format(m, "yyyy-MM")}${sp.provider ? `&provider=${sp.provider}` : ""}`;

  return (
    <>
      <PageHeader
        title="Sessions overview"
        description="Practice usage and a list of every session, for reporting and payroll."
        actions={
          <ButtonLink href={`/api/export/sessions?month=${ym}${sp.provider ? `&provider=${sp.provider}` : ""}`} variant="outline">
            Export CSV
          </ButtonLink>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Link href={nav(addMonths(month, -1))} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
          ←
        </Link>
        <span className="font-semibold">{format(month, "MMMM yyyy")}</span>
        <Link href={nav(addMonths(month, 1))} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm">
          →
        </Link>
        <form className="ml-auto">
          <input type="hidden" name="month" value={ym} />
          <select name="provider" defaultValue={sp.provider ?? ""} className="h-9 rounded-lg border border-line bg-white px-3 text-sm">
            <option value="">All clinicians</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
          <button className="ml-2 h-9 rounded-lg border border-line bg-white px-3 text-sm">Apply</button>
        </form>
      </div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Sessions" value={sessions.length} />
        <Stat label="Hours documented" value={(sessions.reduce((n, s) => n + s.durationSec, 0) / 3600).toFixed(1)} />
        <Stat label="By clinician" value={byProvider.filter((p) => p.count).map((p) => `${p.name.split(" ")[0]} ${p.count}`).join(" · ") || "—"} />
      </div>
      <div className="mb-4">
        <BarChartCard title="Sessions per day" data={days} keys={["Sessions"]} height={200} />
      </div>
      {sessions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">No sessions found.</Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Client</Th>
              <Th>Clinician</Th>
              <Th>Type</Th>
              <Th>Length</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <Td className="text-muted">{date(s.startedAt)}</Td>
                <Td>
                  <Link href={`/sessions/${s.id}`} className="font-medium hover:text-brand-700">
                    {s.client ? `${s.client.firstName} ${s.client.lastName}` : "Unassigned"}
                  </Link>
                </Td>
                <Td>
                  {s.provider.firstName} {s.provider.lastName}
                </Td>
                <Td className="text-muted">{CAPTURE_MODE[s.captureMode as keyof typeof CAPTURE_MODE]}</Td>
                <Td className="text-muted">{s.durationSec ? duration(s.durationSec) : "—"}</Td>
                <Td className="text-muted">{s.documents.length && s.documents.every((d) => d.status === "SIGNED") ? "Signed" : s.documents.length ? "Unsigned" : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
