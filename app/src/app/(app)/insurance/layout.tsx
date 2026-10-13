import { PageHeader, Notice } from "@/components/ui";
import { InsuranceTabs } from "./insurance-tabs";

export default function InsuranceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Insurance" description="Claims, unbilled insurance sessions and payer payments." />
      <Notice tone="info" className="no-print mb-5">
        No clearinghouse is connected, so submission, payer responses and ERAs are simulated locally. The workflow, claim data and
        accounting are real — connect a clearinghouse API to send claims for real.
      </Notice>
      <InsuranceTabs />
      {children}
    </>
  );
}
