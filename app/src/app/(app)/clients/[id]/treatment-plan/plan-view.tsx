"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Flag, Target, ListChecks, Sparkles, Settings2, Loader2, Plus, Trash2, ClipboardList } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Textarea, cn, statusColor } from "@/components/ui";
import { Menu, Modal, useToast } from "@/components/client-ui";
import { RichText } from "@/components/rich-text";
import { OBJECTIVE_STATUS } from "@/lib/constants";
import { dateTime } from "@/lib/format";
import type { PlanArea } from "@/lib/ai/clinical";
import { deletePlan, generatePlan, savePlan } from "../../actions";

type Plan = { caseSnapshot: string; areas: PlanArea[]; generatedAt: string | null; updatedAt: string };
const rid = () => Math.random().toString(36).slice(2, 10);

export function PlanView({ clientId, plan, hasSessions }: { clientId: string; plan: Plan | null; hasSessions: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [openAreas, setOpenAreas] = useState<string[]>(plan?.areas.map((a) => a.id) ?? []);
  const toast = useToast();

  const generate = (instr?: string) =>
    start(async () => {
      const r = await generatePlan(clientId, instr);
      if (r.error) toast(r.error, "error");
      else {
        toast("Treatment plan updated");
        setAssistOpen(false);
        setInstruction("");
      }
    });

  if (!plan) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <ClipboardList className="size-6" />
        </span>
        <h3 className="text-lg font-semibold">No treatment plan yet</h3>
        <p className="mt-1.5 max-w-md text-sm text-muted">
          {hasSessions ? "Draft a plan from this client's sessions, intake and measures, then refine it." : "Draft one from the intake once you have a session, or write it yourself."}
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            Write manually
          </Button>
          {hasSessions && (
            <Button onClick={() => generate()} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate plan
            </Button>
          )}
        </div>
        {editing && <PlanEditor clientId={clientId} plan={{ caseSnapshot: "", areas: [], generatedAt: null, updatedAt: "" }} onClose={() => setEditing(false)} />}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">Treatment plan</h2>
          <p className="text-xs text-muted">Last updated {dateTime(plan.updatedAt)}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAssistOpen(true)}>
            <Sparkles className="size-4 text-brand-600" /> Edit with Assistant
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Settings2 className="size-4" /> Edit plan
          </Button>
          <Menu
            items={[
              { label: "Print / save as PDF", onClick: () => window.print() },
              { label: "Regenerate from record", onClick: () => confirm("Replace this plan with a newly generated one?") && generate() },
              { label: "Delete plan", danger: true, onClick: () => confirm("Delete this treatment plan?") && start(async () => void (await deletePlan(clientId))) },
            ]}
          />
        </div>
      </div>
      <div className="space-y-6 px-6 py-5">
        <section>
          <h3 className="mb-2 text-lg font-semibold">Case snapshot</h3>
          <button onClick={() => setSnapshotOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left font-medium hover:bg-canvas">
            Presentation and history <ChevronDown className={cn("size-4 transition-transform", snapshotOpen && "rotate-180")} />
          </button>
          {snapshotOpen && <div className="prose-note px-4 pt-3" dangerouslySetInnerHTML={{ __html: plan.caseSnapshot || "<p>Not written yet.</p>" }} />}
        </section>
        <section>
          <h3 className="mb-2 text-lg font-semibold">Treatment areas</h3>
          <div className="space-y-3">
            {plan.areas.map((a) => {
              const open = openAreas.includes(a.id);
              return (
                <div key={a.id} className="rounded-xl border border-line">
                  <button onClick={() => setOpenAreas((s) => (open ? s.filter((x) => x !== a.id) : [...s, a.id]))} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <span className="flex items-center gap-2 font-semibold">
                      <ListChecks className="size-4 text-muted" /> {a.title}
                    </span>
                    <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="space-y-4 border-t border-line px-4 py-4">
                      <div className="flex gap-3">
                        <Flag className="mt-0.5 size-4 shrink-0 text-muted" />
                        <p>
                          <strong>Goal:</strong> {a.goal}
                        </p>
                      </div>
                      {a.objectives.map((o) => (
                        <div key={o.id} className="flex gap-3">
                          <Target className="mt-0.5 size-4 shrink-0 text-muted" />
                          <div>
                            <div className="flex items-center gap-2">
                              <strong>Objective</strong>
                              <Badge color={statusColor(o.status)}>{OBJECTIVE_STATUS[o.status]}</Badge>
                            </div>
                            <p>{o.text}</p>
                          </div>
                        </div>
                      ))}
                      {a.interventions.length > 0 && (
                        <div className="flex gap-3">
                          <ListChecks className="mt-0.5 size-4 shrink-0 text-muted" />
                          <div>
                            <strong>Interventions</strong>
                            <ul className="ml-5 list-disc">
                              {a.interventions.map((x, i) => (
                                <li key={i}>{x}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {editing && <PlanEditor clientId={clientId} plan={plan} onClose={() => setEditing(false)} />}
      <Modal
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        title="Update the plan with the Assistant"
        description="Describe what should change. The assistant re-reads the record and revises the plan."
        footer={
          <Button disabled={!instruction.trim() || pending} onClick={() => generate(instruction)}>
            {pending && <Loader2 className="size-4 animate-spin" />} Update plan
          </Button>
        }
      >
        <Textarea rows={4} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Mark the sleep objective as progressing and add a goal about returning to social activities" />
      </Modal>
    </Card>
  );
}

function PlanEditor({ clientId, plan, onClose }: { clientId: string; plan: Plan; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState(plan.caseSnapshot);
  const [areas, setAreas] = useState<PlanArea[]>(plan.areas.length ? plan.areas : [{ id: rid(), title: "", goal: "", objectives: [{ id: rid(), text: "", status: "NOT_STARTED" }], interventions: [] }]);
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<PlanArea>) => setAreas((s) => s.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title="Edit treatment plan"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await savePlan(clientId, {
                  caseSnapshot: snapshot,
                  areas: areas
                    .filter((a) => a.title.trim() || a.goal.trim())
                    .map((a) => ({ ...a, objectives: a.objectives.filter((o) => o.text.trim()), interventions: a.interventions.filter((x) => x.trim()) })),
                });
                onClose();
              })
            }
          >
            Save plan
          </Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-6 overflow-y-auto pr-1 text-left">
        <Field label="Case snapshot — presentation and history">
          <div className="rounded-lg border border-line px-3 py-2">
            <RichText value={snapshot} onChange={setSnapshot} toolbar debounceMs={200} />
          </div>
        </Field>
        {areas.map((a, i) => (
          <div key={a.id} className="space-y-3 rounded-xl border border-line p-4">
            <div className="flex items-center gap-2">
              <Input value={a.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Treatment area, e.g. Anxiety management" className="font-medium" />
              <Button variant="outline" size="sm" onClick={() => setAreas((s) => s.filter((_, j) => j !== i))} title="Remove area">
                <Trash2 className="size-4 text-red-600" />
              </Button>
            </div>
            <Field label="Goal">
              <Textarea rows={2} value={a.goal} onChange={(e) => update(i, { goal: e.target.value })} />
            </Field>
            <div className="space-y-2">
              <div className="text-sm font-medium">Objectives</div>
              {a.objectives.map((o, k) => (
                <div key={o.id} className="flex gap-2">
                  <Input
                    value={o.text}
                    onChange={(e) => update(i, { objectives: a.objectives.map((x, m) => (m === k ? { ...x, text: e.target.value } : x)) })}
                    placeholder="Measurable, time-bound objective"
                  />
                  <Select
                    value={o.status}
                    onChange={(e) => update(i, { objectives: a.objectives.map((x, m) => (m === k ? { ...x, status: e.target.value as PlanArea["objectives"][number]["status"] } : x)) })}
                    className="w-40"
                  >
                    {Object.entries(OBJECTIVE_STATUS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => update(i, { objectives: a.objectives.filter((_, m) => m !== k) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <button onClick={() => update(i, { objectives: [...a.objectives, { id: rid(), text: "", status: "NOT_STARTED" }] })} className="text-sm font-medium text-brand-700">
                + Add objective
              </button>
            </div>
            <Field label="Interventions" hint="One per line">
              <Textarea rows={3} value={a.interventions.join("\n")} onChange={(e) => update(i, { interventions: e.target.value.split("\n") })} />
            </Field>
          </div>
        ))}
        <Button variant="outline" onClick={() => setAreas((s) => [...s, { id: rid(), title: "", goal: "", objectives: [{ id: rid(), text: "", status: "NOT_STARTED" }], interventions: [] }])}>
          <Plus className="size-4" /> Add treatment area
        </Button>
      </div>
    </Modal>
  );
}
