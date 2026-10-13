import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../../client-form";
import { updateClient } from "../../actions";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, providers, services, tags] = await Promise.all([
    db.client.findUnique({ where: { id }, include: { diagnoses: { orderBy: { sortOrder: "asc" } }, tags: true } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" } }, select: { id: true, firstName: true, lastName: true } }),
    db.service.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!c) notFound();
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: `${c.firstName} ${c.lastName}`, href: `/clients/${c.id}` }, { label: "Edit" }]}
        title={`Edit ${c.firstName} ${c.lastName}`}
      />
      <ClientForm
        action={updateClient.bind(null, c.id)}
        initial={{
          ...c,
          dob: c.dob ? c.dob.toISOString().slice(0, 10) : null,
          modalities: c.modalities as string[],
          diagnoses: c.diagnoses.map((d) => ({ code: d.code, description: d.description })),
          tags: c.tags.map((t) => t.name),
        }}
        providers={providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        allTags={tags.map((t) => t.name)}
        submitLabel="Save changes"
      />
    </>
  );
}
