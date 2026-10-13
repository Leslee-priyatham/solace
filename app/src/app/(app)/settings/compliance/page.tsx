import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ComplianceSettings } from "./compliance-settings";

export const metadata = { title: "Compliance checker settings" };

export default async function ComplianceSettingsPage() {
  const [p, groups] = await Promise.all([db.practice.findFirstOrThrow(), db.complianceCriteriaGroup.findMany({ orderBy: { createdAt: "asc" } })]);
  const s = ((p.settings ?? {}) as { compliance?: { autoRun?: boolean; groupId?: string } }).compliance ?? {};
  return (
    <>
      <PageHeader title="Compliance checker" description="Preferences for checking notes against payer documentation criteria." />
      <ComplianceSettings
        settings={{ autoRun: !!s.autoRun, groupId: s.groupId ?? groups[0]?.id ?? "" }}
        groups={groups.map((g) => ({ id: g.id, name: g.name, description: g.description ?? "", isSystem: g.isSystem, criteria: g.criteria as { id: string; title: string; description: string }[] }))}
      />
    </>
  );
}
