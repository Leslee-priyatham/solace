import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, PageHeader, statusColor } from "@/components/ui";
import { CLAIM_STATUS } from "@/lib/constants";
import { claimReadiness } from "../../actions";
import { ClaimView } from "./claim-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.claim.findUnique({ where: { id }, select: { number: true } });
  return { title: c ? `Claim ${c.number}` : "Claim" };
}

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.claim.findUnique({
    where: { id },
    include: {
      client: { include: { diagnoses: { orderBy: { sortOrder: "asc" } }, policies: { where: { archived: false }, include: { payer: true } } } },
      policy: { include: { payer: true } },
      billingProfile: true,
      lines: { orderBy: { serviceDate: "asc" } },
    },
  });
  if (!c) notFound();
  const [profiles, issues, practice] = await Promise.all([db.billingProfile.findMany({ where: { archived: false } }), claimReadiness(id), db.practice.findFirst()]);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Insurance", href: "/insurance" }, { label: `Claim ${c.number}` }]}
        title={
          <span className="flex items-center gap-3">
            Claim {c.number} <Badge color={statusColor(c.status)}>{CLAIM_STATUS[c.status as keyof typeof CLAIM_STATUS]}</Badge>
          </span>
        }
        description={`${c.client.firstName} ${c.client.lastName} · ${c.policy.payer.name}`}
      />
      <ClaimView
        claim={{
          id: c.id,
          number: c.number,
          status: c.status,
          clientId: c.clientId,
          client: {
            name: `${c.client.firstName} ${c.client.lastName}`,
            dob: c.client.dob?.toISOString() ?? null,
            address: c.client.address,
            gender: c.client.gender,
          },
          policyId: c.policyId,
          policy: { payer: c.policy.payer.name, payerCode: c.policy.payer.payerCode, memberId: c.policy.memberId, groupNumber: c.policy.groupNumber, relationship: c.policy.relationship, subscriberName: c.policy.subscriberName },
          billingProfileId: c.billingProfileId,
          billingProfile: c.billingProfile ? { name: c.billingProfile.name, npi: c.billingProfile.npi, taxId: c.billingProfile.taxId, address: c.billingProfile.address } : null,
          diagnosisCodes: c.diagnosisCodes as string[],
          totalCents: c.totalCents,
          paidCents: c.paidCents,
          patientRespCents: c.patientRespCents,
          payerControlNumber: c.payerControlNumber,
          history: (c.history ?? []) as { at: string; status: string; note: string }[],
          lines: c.lines.map((l) => ({ id: l.id, sessionId: l.sessionId, serviceDate: l.serviceDate.toISOString(), cpt: l.cpt, modifiers: l.modifiers ?? "", pos: l.pos, units: l.units, chargeCents: l.chargeCents, dxPointers: l.dxPointers, paidCents: l.paidCents })),
        }}
        policies={c.client.policies.map((p) => ({ id: p.id, label: `${p.payer.name} · ${p.memberId}` }))}
        profiles={profiles.map((p) => ({ id: p.id, label: `${p.name} · NPI ${p.npi}` }))}
        clientDiagnoses={c.client.diagnoses.map((d) => ({ code: d.code, description: d.description }))}
        issues={issues}
        practiceName={practice?.displayName || practice?.name || ""}
      />
    </>
  );
}
