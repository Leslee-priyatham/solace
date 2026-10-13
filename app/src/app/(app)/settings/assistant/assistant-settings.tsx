"use client";

import { useState, useTransition } from "react";
import { Brain, Wand2, Repeat, Trash2, Plus, Pencil, Play, Loader2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { markdownToHtml } from "@/lib/markdown";
import { ago } from "@/lib/format";
import { SaveButton } from "../save-bar";
import { addMemory, clearMemories, deleteMemory, deleteRoutine, deleteSkill, runRoutineNow, saveAssistantPrefs, saveRoutine, saveSkill, toggleRoutine } from "../actions";

type Skill = { id: string; name: string; description: string; instructions: string };
type Routine = { id: string; name: string; description: string; prompt: string; trigger: string; timeOfDay: string; enabled: boolean; lastRunAt: string | null };
const TRIGGERS: Record<string, string> = { MANUAL: "Only when I run it", DAILY: "Every day", BEFORE_SESSION: "Before each session", AFTER_SESSION: "After each session" };

export function AssistantSettings({ prefs, memories, skills, routines }: { prefs: { memory: boolean; guidance: string }; memories: { id: string; content: string; createdAt: string }[]; skills: Skill[]; routines: Routine[] }) {
  const [p, setP] = useState(prefs);
  const [newMemory, setNewMemory] = useState("");
  const [skill, setSkill] = useState<Skill | "new" | null>(null);
  const [routine, setRoutine] = useState<Routine | "new" | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Guidance" description="Standing instructions the assistant always follows." />
        <div className="space-y-4 p-5">
          <Textarea rows={3} value={p.guidance} onChange={(e) => setP({ ...p, guidance: e.target.value })} placeholder="e.g. I practise from a psychodynamic lens. Keep answers brief and use UK spelling." />
          <Checkbox label="Let the assistant remember details I ask it to (say “remember that…” in a chat)" checked={p.memory} onChange={(e) => setP({ ...p, memory: e.target.checked })} />
          <SaveButton action={() => saveAssistantPrefs(p)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Brain className="size-4 text-brand-600" /> Memory
            </span>
          }
          description="Workflow preferences and recurring details the assistant keeps for you."
          actions={memories.length > 0 && <Button size="sm" variant="outline" onClick={() => confirm("Clear all memories?") && start(async () => void (await clearMemories()))}>Clear all</Button>}
        />
        <ul className="divide-y divide-line">
          {memories.length === 0 && <li className="px-5 py-4 text-sm text-muted">Nothing remembered yet.</li>}
          {memories.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <span className="flex-1">{m.content}</span>
              <span className="text-xs text-muted">{ago(m.createdAt)}</span>
              <button onClick={() => start(async () => void (await deleteMemory(m.id)))} className="text-muted hover:text-red-600">
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 border-t border-line p-4">
          <Input value={newMemory} onChange={(e) => setNewMemory(e.target.value)} placeholder="Add something to remember" />
          <Button variant="outline" disabled={!newMemory.trim() || pending} onClick={() => start(async () => (await addMemory(newMemory), setNewMemory("")))}>
            Add
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wand2 className="size-4 text-brand-600" /> Skills
            </span>
          }
          description="Reusable instructions for specific tasks. The assistant applies the right skill when your question matches."
          actions={
            <Button size="sm" onClick={() => setSkill("new")}>
              <Plus className="size-4" /> Create skill
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {skills.length === 0 && <li className="px-5 py-4 text-sm text-muted">No skills yet — e.g. “Referral letter: when asked for a referral letter, write it on practice letterhead with…”</li>}
          {skills.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted">{s.description}</div>
              </div>
              <button onClick={() => setSkill(s)} className="text-muted hover:text-ink">
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Repeat className="size-4 text-brand-600" /> Routines
            </span>
          }
          description="Tasks the assistant runs for you on a schedule or on demand. Results appear in your assistant chats."
          actions={
            <Button size="sm" onClick={() => setRoutine("new")}>
              <Plus className="size-4" /> Create routine
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {routines.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {r.name}
                  <Badge color={r.enabled ? "green" : "gray"}>{r.enabled ? "On" : "Off"}</Badge>
                </div>
                <div className="text-sm text-muted">
                  {r.description || r.prompt.slice(0, 100)} · {TRIGGERS[r.trigger]}
                  {r.trigger === "DAILY" && ` at ${r.timeOfDay}`}
                  {r.lastRunAt && ` · last run ${ago(r.lastRunAt)}`}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => start(async () => void (await toggleRoutine(r.id, !r.enabled)))}>
                {r.enabled ? "Turn off" : "Turn on"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await runRoutineNow(r.id);
                    if (res.error) toast(res.error, "error");
                    else setOutput(res.output ?? "");
                  })
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run now
              </Button>
              <button onClick={() => setRoutine(r)} className="text-muted hover:text-ink">
                <Pencil className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {skill && <SkillModal skill={skill === "new" ? null : skill} onClose={() => setSkill(null)} />}
      {routine && <RoutineModal routine={routine === "new" ? null : routine} onClose={() => setRoutine(null)} />}
      <Modal open={output !== null} onClose={() => setOutput(null)} title="Routine result" size="lg">
        <div className="prose-note max-h-[60vh] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: markdownToHtml(output ?? "") }} />
      </Modal>
    </div>
  );
}

function SkillModal({ skill, onClose }: { skill: Skill | null; onClose: () => void }) {
  const [f, setF] = useState({ name: skill?.name ?? "", description: skill?.description ?? "", instructions: skill?.instructions ?? "" });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={skill ? "Edit skill" : "Create skill"}
      footer={
        <>
          {skill && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await deleteSkill(skill.id), onClose()))}>
              Delete
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveSkill({ id: skill?.id, ...f });
                if (r.error) toast(r.error, "error");
                else onClose();
              })
            }
          >
            Save skill
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Referral letter" />
        </Field>
        <Field label="When to use it">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="When I ask for a referral letter to a psychiatrist or GP" />
        </Field>
        <Field label="Instructions">
          <Textarea rows={8} value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function RoutineModal({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
  const [f, setF] = useState({
    name: routine?.name ?? "",
    description: routine?.description ?? "",
    prompt: routine?.prompt ?? "",
    trigger: routine?.trigger ?? "DAILY",
    timeOfDay: routine?.timeOfDay ?? "08:00",
    enabled: routine?.enabled ?? true,
  });
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={routine ? "Edit routine" : "Create routine"}
      footer={
        <>
          {routine && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await deleteRoutine(routine.id), onClose()))}>
              Delete
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveRoutine({ id: routine?.id, ...f });
                if (r.error) toast(r.error, "error");
                else onClose();
              })
            }
          >
            Save routine
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="When">
          <Select value={f.trigger} onChange={(e) => setF({ ...f, trigger: e.target.value })}>
            {Object.entries(TRIGGERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        {f.trigger === "DAILY" && (
          <Field label="Time">
            <Input type="time" value={f.timeOfDay} onChange={(e) => setF({ ...f, timeOfDay: e.target.value })} />
          </Field>
        )}
        <Field label="What should the assistant do?" className="sm:col-span-2">
          <Textarea rows={5} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
        </Field>
        <Checkbox label="Turned on" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
      </div>
    </Modal>
  );
}
