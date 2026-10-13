import { PageHeader } from "@/components/ui";
import { BillingTabs } from "./billing-tabs";
import { BillingActions } from "./billing-header-actions";

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Payments" actions={<BillingActions />} />
      <BillingTabs />
      {children}
    </>
  );
}
