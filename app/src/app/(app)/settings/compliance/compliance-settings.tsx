"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Copy, Pencil, Lock } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { SaveButton } from "../save-bar";
import { deleteCriteriaGroup, saveComplianceSettings, saveCriteriaGroup } from "../../compliance/actions";

type Group = { id: string; name: string; description: string; isSystem: boolean; criteria: { id: string; title: string; description: string }[] };

export function ComplianceSettings({ settings, groups }: { settings: { autoRun: boolean; groupId: string }; groups: Group[] }) {
  const [s, setS] = useState(settings);
  const [editing, setEditing] = useState<Partial<Group> | null>(null);
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Automatic checks" />
        <div className="space-y-4 p-5">
          <Checkbox label="Run the compliance checker automatically on every new session note" checked={s.autoRun} onChange={(e) => setS({ ...s, autoRun: e.target.checked })} />
          <Field label="Criteria group used for automatic and quick checks">
            <Select value={s.groupId} onChange={(e) => setS({ ...s, groupId: e.target.value })}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <SaveButton action={() => saveComplianceSettings(s)} />
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Criteria groups"
          description="Built-in groups cover common payer expectations. Add your own for specific payers or audits."
          actions={
            <Button size="sm" onClick={() => setEditing({ name: "", description: "", criteria: [{ id: "", title: "", description: "" }] })}>
              <Plus className="size-4" /> New group
            </Button>
          }
        />
        <ul className="divide-y divide-line">
          {groups.map((g) => (
            <li key={g.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {g.name} {g.isSystem && <Badge><Lock className="mr-1 size-3" />Built-in</Badge>}
                </div>
                <div className="text-sm text-muted">
                  {g.criteria.length} criteria{g.description ? ` · ${g.description}` : ""}
                </div>
              </div>
              <button title="Duplicate" onClick={() => setEditing({ name: `${g.name} (copy)`, description: g.description, criteria: g.criteria })} className="text-muted hover:text-ink">
                <Copy className="size-4" />
              </button>
              {!g.isSystem && (
                <button title="Edit" onClick={() => setEditing(g)} className="text-muted hover:text-ink">
                  <Pencil className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {editing && <GroupModal group={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function GroupModal({ group, onClose }: { group: Partial<Group>; onClose: () => void }) {
  const [name, setName] = useState(group.name ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [criteria, setCriteria] = useState(group.criteria ?? []);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={group.id ? "Edit criteria group" : "New criteria group"}
      footer={
        <>
          {group.id && (
            <Button variant="outline" className="mr-auto" onClick={() => start(async () => (await deleteCriteriaGroup(group.id!), onClose()))}>
              Delete
            </Button>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveCriteriaGroup({ id: group.id, name, description, criteria });
                if (r.error) toast(r.error, "error");
                else onClose();
              })
            }
          >
            Save group
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {criteria.map((c, i) => (
          <div key={i} className="flex gap-2 rounded-lg border border-line p-3">
            <div className="flex-1 space-y-2">
              <Input value={c.title} onChange={(e) => setCriteria((cs) => cs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Criterion" />
              <Textarea rows={2} value={c.description} onChange={(e) => setCriteria((cs) => cs.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="What the note must show" />
            </div>
            <button onClick={() => setCriteria((cs) => cs.filter((_, j) => j !== i))} className="text-muted hover:text-red-600">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setCriteria((cs) => [...cs, { id: "", title: "", description: "" }])}>
          <Plus className="size-4" /> Add criterion
        </Button>
      </div>
    </Modal>
  );
}
