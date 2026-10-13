"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, Checkbox, Input } from "@/components/ui";
import { SaveButton } from "../save-bar";
import { saveAvailability } from "../actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
type Rule = { weekday: number; startMin: number; endMin: number };

export function AvailabilityEditor({ initial }: { initial: Rule[] }) {
  const [rules, setRules] = useState(initial);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Card className="max-w-3xl">
      <ul className="divide-y divide-line">
        {order.map((d) => {
          const blocks = rules.map((r, i) => ({ ...r, i })).filter((r) => r.weekday === d);
          return (
            <li key={d} className="flex flex-wrap items-start gap-4 px-5 py-3">
              <div className="w-36 pt-1.5">
                <Checkbox
                  label={DAYS[d]}
                  checked={blocks.length > 0}
                  onChange={(e) => setRules((rs) => (e.target.checked ? [...rs, { weekday: d, startMin: 540, endMin: 1020 }] : rs.filter((r) => r.weekday !== d)))}
                />
              </div>
              <div className="flex-1 space-y-2">
                {blocks.length === 0 && <div className="pt-1.5 text-sm text-muted">Unavailable</div>}
                {blocks.map((b) => (
                  <div key={b.i} className="flex items-center gap-2">
                    <Input type="time" value={toTime(b.startMin)} onChange={(e) => setRules((rs) => rs.map((r, j) => (j === b.i ? { ...r, startMin: toMin(e.target.value) } : r)))} className="w-32" />
                    <span className="text-muted">–</span>
                    <Input type="time" value={toTime(b.endMin)} onChange={(e) => setRules((rs) => rs.map((r, j) => (j === b.i ? { ...r, endMin: toMin(e.target.value) } : r)))} className="w-32" />
                    <button onClick={() => setRules((rs) => rs.filter((_, j) => j !== b.i))} className="text-muted hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              {blocks.length > 0 && (
                <button onClick={() => setRules((rs) => [...rs, { weekday: d, startMin: 1080, endMin: 1200 }])} className="pt-1.5 text-muted hover:text-ink" title="Add another block">
                  <Plus className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line px-5 py-3">
        <SaveButton action={() => saveAvailability(rules)} />
      </div>
    </Card>
  );
}
