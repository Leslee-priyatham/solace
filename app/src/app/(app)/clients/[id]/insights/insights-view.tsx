"use client";

import { useState, useTransition } from "react";
import { LineChart as LineIcon, Plus } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui";
import { Modal } from "@/components/client-ui";
import { date } from "@/lib/format";
import { MEASURE_SEVERITY } from "@/lib/library";
import { addMeasureScore } from "../../actions";

type Score = { id: string; measure: string; score: number; severity: string; takenAt: string };
const NAMES: Record<string, string> = { PHQ9: "PHQ-9 · Depression", GAD7: "GAD-7 · Anxiety" };
const BAND_COLORS = ["#ecfdf5", "#f7fee7", "#fefce8", "#fff7ed", "#fef2f2"];

export function InsightsView({ clientId, scores }: { clientId: string; scores: Score[] }) {
  const [open, setOpen] = useState(false);
  const measures = (["PHQ9", "GAD7"] as const).filter((m) => scores.some((s) => s.measure === m));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Record a score
        </Button>
      </div>
      {measures.length === 0 ? (
        <Card>
          <EmptyState icon={<LineIcon className="size-6" />} title="Progress insights" description="When a PHQ-9 or GAD-7 is completed through a form, or you record a score, you'll see the trend over time here." />
        </Card>
      ) : (
        measures.map((m) => {
          const rows = scores.filter((s) => s.measure === m);
          const first = rows[0];
          const last = rows[rows.length - 1];
          const change = last.score - first.score;
          const bands = MEASURE_SEVERITY[m].bands;
          return (
            <Card key={m}>
              <CardHeader
                title={NAMES[m]}
                description={`${rows.length} result${rows.length === 1 ? "" : "s"} · latest ${last.score} (${last.severity}) on ${date(last.takenAt)}`}
                actions={
                  rows.length > 1 && (
                    <Badge color={change < 0 ? "green" : change > 0 ? "red" : "gray"}>
                      {change < 0 ? "↓" : change > 0 ? "↑" : "→"} {Math.abs(change)} since {date(first.takenAt, "MMM d")}
                    </Badge>
                  )
                }
              />
              <div className="h-64 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows.map((r) => ({ date: date(r.takenAt, "MMM d"), score: r.score }))} margin={{ left: 0, right: 16, top: 8 }}>
                    {bands.map(([max], i) => (
                      <ReferenceArea key={i} y1={i === 0 ? 0 : bands[i - 1][0]} y2={max} fill={BAND_COLORS[i]} fillOpacity={1} ifOverflow="hidden" />
                    ))}
                    <CartesianGrid stroke="#e3e8e7" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, MEASURE_SEVERITY[m].max]} tick={{ fontSize: 12, fill: "#5d6b69" }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e7", fontSize: 13 }} />
                    <Line type="monotone" dataKey="score" stroke="#0a8c76" strokeWidth={2.5} dot={{ r: 4, fill: "#0a8c76" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-line px-5 py-3 text-xs text-muted">
                {bands.map(([max, label], i) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="size-3 rounded-sm border border-line" style={{ background: BAND_COLORS[i] }} />
                    {label} ({i === 0 ? 0 : bands[i - 1][0] + 1}–{max})
                  </span>
                ))}
              </div>
            </Card>
          );
        })
      )}
      {open && <ScoreModal clientId={clientId} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ScoreModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [measure, setMeasure] = useState("PHQ9");
  const [score, setScore] = useState("");
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  const max = MEASURE_SEVERITY[measure].max;
  return (
    <Modal
      open
      onClose={onClose}
      title="Record a measure score"
      footer={
        <Button
          disabled={pending || score === "" || Number(score) < 0 || Number(score) > max}
          onClick={() =>
            start(async () => {
              await addMeasureScore(clientId, measure, Number(score), when);
              onClose();
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Measure">
          <Select value={measure} onChange={(e) => setMeasure(e.target.value)}>
            <option value="PHQ9">PHQ-9</option>
            <option value="GAD7">GAD-7</option>
          </Select>
        </Field>
        <Field label={`Score (0–${max})`}>
          <Input type="number" min={0} max={max} value={score} onChange={(e) => setScore(e.target.value)} />
        </Field>
        <Field label="Date">
          <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
