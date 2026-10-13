import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { Avatar, Badge, PageHeader, statusColor } from "@/components/ui";
import { CLIENT_STATUS } from "@/lib/constants";
import { ClientTabs } from "./client-tabs";
import { ClientHeaderActions } from "./header-actions";
import { ClientSidebar } from "./client-sidebar";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.client.findUnique({
    where: { id },
    include: {
      diagnoses: { orderBy: { sortOrder: "asc" } },
      contacts: { where: { archived: false } },
      tags: true,
      provider: { select: { firstName: true, lastName: true } },
      policies: { where: { archived: false }, include: { payer: true }, orderBy: { priority: "asc" } },
    },
  });
  if (!c) notFound();
  const [templates, formsCompleted, consent] = await Promise.all([
    db.noteTemplate.findMany({ where: { archived: false }, select: { id: true, name: true, category: true } }),
    db.formRequest.count({ where: { clientId: id, status: "COMPLETED" } }),
    db.formRequest.findFirst({ where: { clientId: id, form: { kind: "CONSENT" } }, orderBy: { sentAt: "desc" }, include: { form: true } }),
  ]);
  const name = `${c.preferredName || c.firstName} ${c.lastName}`;
  const prefs = (c.notePrefs ?? {}) as { templateId?: string; clientNoteTemplateId?: string | null };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <PageHeader
          breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: name }]}
          title={
            <span className="flex items-center gap-3">
              <Avatar name={name} />
              {name}
              <Badge color={statusColor(c.status)}>{CLIENT_STATUS[c.status as keyof typeof CLIENT_STATUS]}</Badge>
              {c.isDemo && <Badge color="violet">Demo</Badge>}
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-4 text-sm">
              {c.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {c.email}
                </span>
              )}
              {c.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {c.phone}
                </span>
              )}
              <span>{c.mrn}</span>
            </span>
          }
          actions={<ClientHeaderActions clientId={c.id} status={c.status} portalToken={c.portalToken} />}
        />
        <ClientTabs clientId={c.id} />
        {children}
      </div>
      <ClientSidebar
        client={{
          id: c.id,
          kind: c.kind,
          pronouns: c.pronouns,
          email: c.email,
          phone: c.phone,
          dob: c.dob?.toISOString() ?? null,
          address: c.address,
          modalities: c.modalities as string[],
          diagnoses: c.diagnoses.map((d) => ({ code: d.code, description: d.description })),
          tags: c.tags.map((t) => t.name),
          provider: c.provider ? `${c.provider.firstName} ${c.provider.lastName}` : null,
          billingType: c.billingType,
          portalToken: c.portalToken,
          policies: c.policies.map((p) => ({ id: p.id, payer: p.payer.name, memberId: p.memberId, priority: p.priority })),
          contacts: c.contacts.map((x) => ({ id: x.id, name: x.name, relationship: x.relationship, email: x.email, phone: x.phone, isEmergency: x.isEmergency, isParticipant: x.isParticipant })),
        }}
        notePrefs={prefs}
        templates={templates}
        formsCompleted={formsCompleted}
        consent={consent ? { status: consent.status, name: consent.form.name, completedAt: consent.completedAt?.toISOString() ?? null } : null}
      />
    </div>
  );
}
