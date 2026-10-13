import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { Card, EmptyState } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { SummaryActions } from "./summary-actions";
import type { SummaryContent } from "@/lib/ai/clinical";

export default async function SummaryTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, summary, sessions] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id }, include: { diagnoses: { orderBy: { sortOrder: "asc" } } } }),
    db.treatmentSummary.findUnique({ where: { clientId: id } }),
    db.session.count({ where: { clientId: id } }),
  ]);
  const source = summary?.sourceSessionId ? await db.session.findUnique({ where: { id: summary.sourceSessionId }, select: { id: true, title: true } }) : null;

  if (!summary) {
    return (
      <Card>
        <EmptyState
          icon={<FileText className="size-6" />}
          title="Treatment summary"
          description={sessions ? "Generate a summary of this client's course of treatment from their notes, chart notes and measures." : "Once this client has session notes, you can generate a treatment summary here."}
          action={sessions ? <SummaryActions clientId={id} hasSummary={false} sharedText={c.portalSummary} plainText="" /> : undefined}
        />
      </Card>
    );
  }

  const s = summary.content as unknown as SummaryContent;
  const plain = [
    `Presenting concerns: ${s.presentingConcerns}`,
    `Goals:\n${s.goals.map((g) => `- ${g}`).join("\n")}`,
    `Progress: ${s.progress}`,
    `Next steps:\n${s.nextSteps.map((g) => `- ${g}`).join("\n")}`,
  ].join("\n\n");

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Treatment summary</h2>
          <p className="text-sm text-muted">
            Generated {dateTime(summary.generatedAt)}
            {source && (
              <>
                {" "}
                from{" "}
                <Link href={`/sessions/${source.id}`} className="text-brand-700">
                  {source.title ?? "latest session"}
                </Link>
              </>
            )}
          </p>
        </div>
        <SummaryActions clientId={id} hasSummary sharedText={c.portalSummary} plainText={plain} />
      </div>
      <div className="prose-note space-y-5 px-6 py-5">
        <Block title="Diagnosis">
          {c.diagnoses.length ? (
            <ul>
              {c.diagnoses.map((d) => (
                <li key={d.code}>
                  <strong>{d.code}</strong> {d.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">None recorded.</p>
          )}
        </Block>
        <Block title="Therapeutic modalities">
          <p>{(c.modalities as string[]).join(", ") || "None recorded."}</p>
        </Block>
        <Block title="Presenting concerns">
          <p>{s.presentingConcerns}</p>
        </Block>
        <Block title="Goals">
          <ul>
            {s.goals.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Block>
        <Block title="Progress">
          <p>{s.progress}</p>
        </Block>
        <Block title="Interventions used">
          <ul>
            {s.interventions.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Block>
        <Block title="Risk">
          <p>{s.risk}</p>
        </Block>
        <Block title="Next steps">
          <ul>
            {s.nextSteps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Block>
      </div>
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
