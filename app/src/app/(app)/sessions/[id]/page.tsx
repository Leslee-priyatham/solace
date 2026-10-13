import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CAPTURE_MODE } from "@/lib/constants";
import { date } from "@/lib/format";
import { SessionView } from "./session-view";
import type { LabeledUtterance } from "@/lib/ai/clinical";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.session.findUnique({ where: { id }, select: { title: true } });
  return { title: s?.title ?? "Session" };
}

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ note?: string }> }) {
  await requireUser();
  const { id } = await params;
  const { note } = await searchParams;
  const s = await db.session.findUnique({
    where: { id },
    include: {
      client: { include: { diagnoses: true } },
      provider: true,
      documents: { orderBy: { createdAt: "asc" }, include: { template: { select: { sections: true, category: true } } } },
      invoiceItems: { include: { invoice: { select: { id: true, number: true, status: true } } } },
      claimLines: { include: { claim: { select: { id: true, number: true, status: true } } } },
    },
  });
  if (!s) notFound();
  if (!s.seenAt) await db.session.update({ where: { id }, data: { seenAt: new Date() } });

  const [templates, groups, clients] = await Promise.all([
    db.noteTemplate.findMany({ where: { archived: false }, orderBy: [{ isSystem: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true } }),
    db.complianceCriteriaGroup.findMany({ select: { id: true, name: true } }),
    db.client.findMany({ where: { status: { not: "DISCHARGED" } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);

  const clientName = s.client ? `${s.client.firstName} ${s.client.lastName}` : null;
  const kind = s.client?.kind === "COUPLE" ? "Couples" : s.client?.kind === "FAMILY" ? "Family" : "Individual";

  return (
    <>
      <PageHeader
        breadcrumbs={
          s.client
            ? [{ label: "Clients", href: "/clients" }, { label: clientName!, href: `/clients/${s.client.id}` }, { label: s.title ?? "Session" }]
            : [{ label: "Sessions", href: "/sessions" }, { label: s.title ?? "Session" }]
        }
        title={s.title || "Untitled session"}
        description={`${kind} ${CAPTURE_MODE[s.captureMode as keyof typeof CAPTURE_MODE].toLowerCase()} session on ${date(s.startedAt)}`}
      />
      <SessionView
        initialNoteId={note}
        session={{
          id: s.id,
          title: s.title ?? "",
          status: s.status,
          error: s.error,
          captureMode: s.captureMode,
          startedAt: s.startedAt.toISOString(),
          durationSec: s.durationSec,
          hasAudio: !!s.audioPath,
          audioPath: s.audioPath,
          rawText: s.rawText,
          transcript: s.transcript as unknown as LabeledUtterance[],
          chapters: (s.chapters ?? []) as unknown as { title: string; start: number }[],
          analytics: (s.analytics ?? {}) as { providerSec?: number; clientSec?: number; silenceSec?: number },
          cpt: s.cpt,
          feeCents: s.feeCents,
          billingType: s.billingType,
          isDemo: s.isDemo,
          provider: `${s.provider.firstName} ${s.provider.lastName}`,
          client: s.client
            ? {
                id: s.client.id,
                name: clientName!,
                email: s.client.email,
                diagnoses: s.client.diagnoses.map((d) => d.code),
              }
            : null,
          invoices: s.invoiceItems.map((i) => i.invoice),
          claims: s.claimLines.map((l) => l.claim),
        }}
        documents={s.documents.map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          signedAt: d.signedAt?.toISOString() ?? null,
          signature: d.signature,
          category: d.template?.category ?? "PROGRESS",
          sections: d.sections as unknown as { id: string; title: string; html: string; rating?: "up" | "down" | null }[],
          compliance: d.compliance as { score: number; summary: string; groupName: string; checkedAt: string; items: { criterionId: string; status: string; finding: string; suggestion: string }[] } | null,
        }))}
        templates={templates}
        complianceGroups={groups}
        clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))}
      />
    </>
  );
}
