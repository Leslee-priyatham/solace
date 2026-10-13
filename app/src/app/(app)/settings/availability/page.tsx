import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { AvailabilityEditor } from "./availability-editor";

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const u = await requireUser();
  const rules = await db.availabilityRule.findMany({ where: { userId: u.id }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
  return (
    <>
      <PageHeader title="Availability" description="Your regular working hours. Online booking only offers times inside these blocks." />
      <AvailabilityEditor initial={rules.map((r) => ({ weekday: r.weekday, startMin: r.startMin, endMin: r.endMin }))} />
    </>
  );
}
