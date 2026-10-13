import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ClinicalForm } from "./clinical-form";

export const metadata = { title: "Clinical info" };

export default async function ClinicalPage() {
  const u = await requireUser();
  return (
    <>
      <PageHeader title="Clinical info" description="Used on superbills, claims and note signatures." />
      <ClinicalForm initial={{ npi: u.npi ?? "", taxonomy: u.taxonomy ?? "", taxIdType: u.taxIdType ?? "EIN", taxId: u.taxId ?? "", license: u.license ?? "" }} />
    </>
  );
}
