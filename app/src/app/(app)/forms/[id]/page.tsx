import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { FormBuilder } from "./form-builder";
import { LibraryPreview } from "./library-preview";
import type { FormField } from "@/lib/forms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await db.form.findUnique({ where: { id }, select: { name: true } });
  return { title: f?.name ?? "Form" };
}

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await db.form.findUnique({ where: { id } });
  if (!f) notFound();
  const fields = (f.fields ?? []) as unknown as FormField[];
  if (f.isLibrary) {
    return (
      <>
        <PageHeader
          breadcrumbs={[{ label: "Practice forms", href: "/forms" }, { label: "Template library", href: "/forms/library" }, { label: f.name }]}
          title={
            <span className="flex items-center gap-2">
              {f.name} <Badge color="brand">Library</Badge>
            </span>
          }
          description={f.description}
        />
        <LibraryPreview id={f.id} fields={fields} />
      </>
    );
  }
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Practice forms", href: "/forms" }, { label: f.name }]} title="Edit form" />
      <FormBuilder form={{ id: f.id, name: f.name, description: f.description ?? "", kind: f.kind, measure: f.measure, fields }} />
      {fields.length === 0 && <Card className="mt-4 p-6 text-sm text-muted">Add your first question to get started.</Card>}
    </>
  );
}
