import { db } from "@/lib/db";
import { PlanView } from "./plan-view";
import type { PlanArea } from "@/lib/ai/clinical";

export default async function TreatmentPlanTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan, sessions] = await Promise.all([db.treatmentPlan.findUnique({ where: { clientId: id } }), db.session.count({ where: { clientId: id } })]);
  return (
    <PlanView
      clientId={id}
      hasSessions={sessions > 0}
      plan={plan ? { caseSnapshot: plan.caseSnapshot, areas: plan.areas as unknown as PlanArea[], generatedAt: plan.generatedAt?.toISOString() ?? null, updatedAt: plan.updatedAt.toISOString() } : null}
    />
  );
}
