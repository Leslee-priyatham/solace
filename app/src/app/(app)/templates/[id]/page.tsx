import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "./template-editor";
import type { TemplateSection } from "@/lib/ai/clinical";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.noteTemplate.findUnique({ where: { id }, select: { name: true } });
  return { title: t?.name ?? "Template" };
}

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.noteTemplate.findUnique({ where: { id } });
  if (!t) notFound();
  const sessions = await db.session.findMany({
    where: { status: "READY" },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: { id: true, title: true, startedAt: true, client: { select: { firstName: true, lastName: true } } },
  });
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Note templates", href: "/templates" }, { label: t.name }]} title={t.isSystem ? t.name : "Edit template"} description={t.isSystem ? t.description : undefined} />
      <TemplateEditor
        template={{
          id: t.id,
          name: t.name,
          description: t.description ?? "",
          category: t.category,
          audience: t.audience,
          guidance: t.guidance ?? "",
          sections: t.sections as unknown as TemplateSection[],
          isSystem: t.isSystem,
        }}
        sessions={sessions.map((s) => ({
          id: s.id,
          label: `${s.startedAt.toISOString().slice(0, 10)} · ${s.client ? `${s.client.firstName} ${s.client.lastName}` : "Unassigned"} · ${s.title ?? "Untitled"}`,
        }))}
      />
    </>
  );
}
