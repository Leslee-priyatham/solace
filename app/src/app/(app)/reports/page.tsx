import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, CardHeader, PageHeader, cn } from "@/components/ui";
import { BarChartCard, DonutCard, LineChartCard } from "@/components/charts";
import { computeTile, type Range } from "@/lib/reports";
import { REPORT_METRICS } from "@/lib/constants";
import { DashboardControls, TileMenu } from "./dashboard-controls";

export const metadata = { title: "Reports" };

const RANGES: [Range, string][] = [
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["12m", "Last 12 months"],
  ["all", "All time"],
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const [dashboards, providers] = await Promise.all([
    db.dashboard.findMany({ orderBy: { sortOrder: "asc" }, include: { tiles: { orderBy: { sortOrder: "asc" } } } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" } }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const active = dashboards.find((x) => x.id === d) ?? dashboards[0];
  const filters = (active?.filters ?? {}) as { range?: Range; providerId?: string };
  const range = filters.range ?? "90d";
  const data = active ? await Promise.all(active.tiles.map((t) => computeTile(t.metric, range, filters.providerId || undefined))) : [];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Reports <Badge color="brand">Beta</Badge>
          </span>
        }
        description="Practice dashboards built from your sessions, clients, notes and payments."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
          {dashboards.map((x) => (
            <Link key={x.id} href={`/reports?d=${x.id}`} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", x.id === active?.id ? "bg-brand-50 text-brand-800" : "text-muted")}>
              {x.name}
            </Link>
          ))}
        </div>
        {active && (
          <DashboardControls
            dashboard={{ id: active.id, name: active.name }}
            range={range}
            ranges={RANGES}
            providerId={filters.providerId ?? ""}
            providers={providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
            metrics={Object.entries(REPORT_METRICS).map(([key, m]) => ({ key, ...m }))}
          />
        )}
      </div>
      {active && active.tiles.length === 0 && <Card className="p-10 text-center text-sm text-muted">This dashboard is empty. Use “Add report” to add charts.</Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {active?.tiles.map((t, i) => {
          const tile = data[i];
          const desc = REPORT_METRICS[t.metric]?.description;
          const menu = <TileMenu id={t.id} wide={t.width === 2} />;
          return (
            <div key={t.id} className={cn("relative", t.width === 2 && "lg:col-span-2")}>
              <div className="absolute right-3 top-3 z-10">{menu}</div>
              {tile.kind === "bar" ? (
                <BarChartCard title={t.title} description={desc} data={tile.data} keys={tile.keys} currency={tile.currency} />
              ) : tile.kind === "line" ? (
                <LineChartCard title={t.title} description={desc} data={tile.data} keys={tile.keys} />
              ) : tile.kind === "donut" ? (
                <DonutCard title={t.title} description={desc} data={tile.data} />
              ) : tile.kind === "number" ? (
                <Card className="h-full">
                  <CardHeader title={t.title} description={desc} />
                  <div className="px-5 py-8">
                    <div className="text-4xl font-semibold tracking-tight">{tile.value}</div>
                    {tile.hint && <div className="mt-1 text-sm text-muted">{tile.hint}</div>}
                  </div>
                </Card>
              ) : (
                <Card className="h-full">
                  <CardHeader title={t.title} description={desc} />
                  <ul className="divide-y divide-line">
                    {tile.rows.map((r, k) => (
                      <li key={k} className="flex justify-between px-5 py-2.5 text-sm">
                        {r.href ? (
                          <Link href={r.href} className="font-medium hover:text-brand-700">
                            {r.label}
                          </Link>
                        ) : (
                          <span className="text-muted">{r.label}</span>
                        )}
                        <span className="tabular-nums">{r.value}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
