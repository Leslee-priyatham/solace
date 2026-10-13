import Link from "next/link";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/ai/client";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { ComplianceRunner } from "./compliance-runner";

export const metadata = { title: "Compliance checker" };

export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ check?: string }> }) {
  const { check } = await searchParams;
  const [groups, notes, history, aiReady] = await Promise.all([
    db.complianceCriteriaGroup.findMany({ orderBy: { createdAt: "asc" } }),
    db.noteDocument.findMany({
      where: { status: { in: ["DRAFT", "SIGNED"] }, template: { category: { not: "CLIENT_NOTE" } } },
      include: { session: { include: { client: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    db.complianceCheck.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    isConfigured("text"),
  ]);
  const selected = check ? await db.complianceCheck.findUnique({ where: { id: check } }) : history.find((h) => h.status === "DONE") ?? null;
  const result = selected?.result as { score: number; summary: string; groupName: string; items: { criterionId: string; status: string; finding: string; suggestion: string }[] } | null;
  const noteLabels = Object.fromEntries(notes.map((n) => [n.id, `${n.title} · ${n.session?.client ? `${n.session.client.firstName} ${n.session.client.lastName}` : "Unassigned"}`]));

  return (
    <>
      <PageHeader title="Compliance checker" description="Find out whether notes meet insurance payer documentation criteria before you submit them." />
      {!aiReady && (
        <Notice tone="warn" className="mb-5">
          The checker uses your writing model.{" "}
          <Link href="/settings/ai" className="font-medium underline">
            Set up an AI provider
          </Link>{" "}
          first.
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <ComplianceRunner
            groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description }))}
            notes={notes.map((n) => ({ id: n.id, label: `${noteLabels[n.id]} · ${n.updatedAt.toISOString().slice(0, 10)}` }))}
          />
          {result && selected && (
            <Card>
              <CardHeader title={selected.fileName ?? noteLabels[selected.noteDocumentId ?? ""] ?? "Note"} description={`${result.groupName} · ${dateTime(selected.createdAt)}`} />
              <div className="flex items-center gap-4 px-5 py-4">
                <div className={`flex size-16 items-center justify-center rounded-full text-xl font-semibold ${result.score >= 85 ? "bg-emerald-50 text-emerald-700" : result.score >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                  {result.score}%
                </div>
                <p className="text-sm text-muted">{result.summary}</p>
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {result.items.map((i) => (
                  <li key={i.criterionId} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge color={i.status === "pass" ? "green" : i.status === "warn" ? "amber" : "red"}>{i.status === "pass" ? "Meets" : i.status === "warn" ? "Partial" : "Missing"}</Badge>
                      <span className="text-sm font-medium">{i.criterionId.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{i.finding}</p>
                    {i.suggestion && <p className="mt-1 text-sm text-brand-800">→ {i.suggestion}</p>}
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-5 py-3 text-xs text-muted">This check is an aid, not legal advice, and can be wrong. Review the final note yourself.</p>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Recent checks" />
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No checks yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => {
                const r = h.result as { score?: number } | null;
                return (
                  <li key={h.id}>
                    <Link href={`/compliance?check=${h.id}`} className={`flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-canvas ${selected?.id === h.id ? "bg-brand-50" : ""}`}>
                      <span className="min-w-0 truncate">{h.fileName ?? noteLabels[h.noteDocumentId ?? ""] ?? "Session note"}</span>
                      {h.status === "DONE" ? <Badge color={(r?.score ?? 0) >= 85 ? "green" : (r?.score ?? 0) >= 60 ? "amber" : "red"}>{r?.score}%</Badge> : <Badge color={h.status === "ERROR" ? "red" : "gray"}>{h.status.toLowerCase()}</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
