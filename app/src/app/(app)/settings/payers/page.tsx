import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PayersView } from "./payers-view";

export const metadata = { title: "Payers & enrollments" };

export default async function PayersPage() {
  const [payers, profiles, enrollments] = await Promise.all([
    db.payer.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { policies: true } } } }),
    db.billingProfile.findMany({ where: { archived: false } }),
    db.payerEnrollment.findMany({ include: { payer: true, billingProfile: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Payers & enrollments" description="Insurance companies you bill, and your enrollment status with each." />
      <PayersView
        payers={payers.map((p) => ({ id: p.id, name: p.name, payerCode: p.payerCode, address: p.address ?? "", phone: p.phone ?? "", policies: p._count.policies }))}
        profiles={profiles.map((p) => ({ id: p.id, name: `${p.name} · ${p.npi}` }))}
        enrollments={enrollments.map((e) => ({ id: e.id, payer: e.payer.name, profile: e.billingProfile.name, status: e.status, submittedAt: e.submittedAt?.toISOString() ?? null }))}
      />
    </>
  );
}
