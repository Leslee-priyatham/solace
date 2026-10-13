import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ProfilesView } from "./profiles-view";

export const metadata = { title: "Billing profiles" };

export default async function BillingProfilesPage() {
  const profiles = await db.billingProfile.findMany({ orderBy: [{ archived: "asc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Billing profiles" description="The NPIs and tax IDs your practice uses to submit claims and check eligibility." />
      <ProfilesView profiles={profiles.map((p) => ({ id: p.id, name: p.name, kind: p.kind, npi: p.npi, taxId: p.taxId, taxonomy: p.taxonomy ?? "", address: p.address ?? "", archived: p.archived }))} />
    </>
  );
}
