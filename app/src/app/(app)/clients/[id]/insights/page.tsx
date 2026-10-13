import { db } from "@/lib/db";
import { InsightsView } from "./insights-view";

export default async function InsightsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scores = await db.measureScore.findMany({ where: { clientId: id }, orderBy: { takenAt: "asc" } });
  return <InsightsView clientId={id} scores={scores.map((s) => ({ id: s.id, measure: s.measure, score: s.score, severity: s.severity, takenAt: s.takenAt.toISOString() }))} />;
}
