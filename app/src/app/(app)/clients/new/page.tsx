import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";
import { createClient } from "../actions";

export const metadata = { title: "Add client" };

export default async function NewClientPage() {
  const user = await requireUser();
  const prefs = (user.preferences ?? {}) as { defaultModalities?: string[] };
  const [providers, services, tags] = await Promise.all([
    db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" } }, select: { id: true, firstName: true, lastName: true } }),
    db.service.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "Add client" }]} title="Add a client" />
      <ClientForm
        action={createClient}
        initial={{ modalities: prefs.defaultModalities ?? [] }}
        providers={providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        allTags={tags.map((t) => t.name)}
        submitLabel="Add client"
      />
    </>
  );
}
