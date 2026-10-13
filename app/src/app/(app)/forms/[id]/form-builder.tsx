"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Trash2, Plus, Eye, Pencil, GripVertical, Loader2, Copy } from "lucide-react";
import { Button, Card, Checkbox, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { FormRenderer } from "@/components/form-renderer";
import { FORM_FIELD_TYPES } from "@/lib/constants";
import type { Answers, FormField } from "@/lib/forms";
import { deleteForm, saveForm } from "../actions";

const rid = () => Math.random().toString(36).slice(2, 10);
const HAS_OPTIONS = ["single_choice", "multi_choice", "scale"];

export function FormBuilder({ form }: { form: { id: string; name: string; description: string; kind: string; measure: string | null; fields: FormField[] } }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description);
  const [kind, setKind] = useState(form.kind);
  const [measure, setMeasure] = useState(form.measure ?? "");
  const [fields, setFields] = useState<FormField[]>(form.fields);
  const [selected, setSelected] = useState<string | null>(form.fields[0]?.id ?? null);
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  const update = (id: string, patch: Partial<FormField>) => {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setFields((fs) => {
      const copy = [...fs];
      const j = i + dir;
      if (j < 0 || j >= copy.length) return fs;
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    setDirty(true);
  };
  const add = (type: string) => {
    const f: FormField = {
      id: rid(),
      type,
      label: type === "heading" ? "Section title" : type === "paragraph" ? "Information for the client." : "New question",
      ...(HAS_OPTIONS.includes(type) ? { options: type === "scale" ? ["Not at all", "Sometimes", "Often", "Always"] : ["Option 1", "Option 2"] } : {}),
      ...(type === "scale" ? { scores: [0, 1, 2, 3] } : {}),
    };
    const idx = fields.findIndex((x) => x.id === selected);
    setFields((fs) => (idx >= 0 ? [...fs.slice(0, idx + 1), f, ...fs.slice(idx + 1)] : [...fs, f]));
    setSelected(f.id);
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const r = await saveForm(form.id, { name, description, kind, measure: measure || null, fields });
      if (r.error) toast(r.error, "error");
      else {
        toast("Form saved");
        setDirty(false);
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 p-5 md:grid-cols-[1fr_180px_180px]">
        <Field label="Form name">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </Field>
        <Field label="Type">
          <Select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setDirty(true);
            }}
          >
            <option value="INTAKE">Intake</option>
            <option value="CONSENT">Consent</option>
            <option value="ASSESSMENT">Assessment</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Scoring" hint="Scored forms feed client Insights.">
          <Select
            value={measure}
            onChange={(e) => {
              setMeasure(e.target.value);
              setDirty(true);
            }}
          >
            <option value="">Not scored</option>
            <option value="PHQ9">PHQ-9</option>
            <option value="GAD7">GAD-7</option>
          </Select>
        </Field>
        <Field label="Description" className="md:col-span-3">
          <Input
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDirty(true);
            }}
            placeholder="Shown to clients above the form"
          />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={preview ? "secondary" : "outline"} size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? <Pencil className="size-4" /> : <Eye className="size-4" />} {preview ? "Back to editing" : "Preview"}
        </Button>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirm("Delete this form? Forms that were already sent are archived instead.") && start(async () => (await deleteForm(form.id), router.push("/forms")))}
          >
            <Trash2 className="size-4 text-red-600" /> Delete
          </Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>
            {pending && <Loader2 className="size-4 animate-spin" />} {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {preview ? (
        <Card className="mx-auto max-w-2xl p-8">
          <h2 className="text-xl font-semibold">{name}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <div className="mt-6">
            <FormRenderer fields={fields} answers={answers} onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            {fields.map((f, i) => (
              <Card key={f.id} className={cn("cursor-pointer p-4 transition", selected === f.id ? "ring-2 ring-brand-500" : "hover:border-brand-200")} onClick={() => setSelected(f.id)}>
                <div className="flex items-start gap-3">
                  <GripVertical className="mt-2 size-4 shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{FORM_FIELD_TYPES[f.type as keyof typeof FORM_FIELD_TYPES] ?? f.type}</span>
                      {f.required && <span className="text-xs text-red-600">Required</span>}
                    </div>
                    {selected === f.id ? (
                      <FieldEditor field={f} onChange={(patch) => update(f.id, patch)} />
                    ) : (
                      <div className={cn("text-sm", f.type === "heading" && "text-base font-semibold")}>{f.label}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => move(i, -1)} className="rounded p-1 text-muted hover:bg-black/5" title="Move up">
                      <ArrowUp className="size-4" />
                    </button>
                    <button onClick={() => move(i, 1)} className="rounded p-1 text-muted hover:bg-black/5" title="Move down">
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        const copy = { ...f, id: rid() };
                        setFields((fs) => [...fs.slice(0, i + 1), copy, ...fs.slice(i + 1)]);
                        setDirty(true);
                      }}
                      className="rounded p-1 text-muted hover:bg-black/5"
                      title="Duplicate"
                    >
                      <Copy className="size-4" />
                    </button>
                    <button
                      onClick={() => {
                        setFields((fs) => fs.filter((x) => x.id !== f.id));
                        setDirty(true);
                      }}
                      className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card className="h-fit p-3 lg:sticky lg:top-6">
            <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Add a field</div>
            {Object.entries(FORM_FIELD_TYPES).map(([type, label]) => (
              <button key={type} onClick={() => add(type)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-canvas">
                <Plus className="size-3.5 text-brand-600" /> {label}
              </button>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function FieldEditor({ field: f, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const isBlock = f.type === "heading" || f.type === "paragraph";
  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      {f.type === "paragraph" ? (
        <Textarea rows={3} value={f.label} onChange={(e) => onChange({ label: e.target.value })} />
      ) : (
        <Input value={f.label} onChange={(e) => onChange({ label: e.target.value })} placeholder={isBlock ? "Title" : "Question"} autoFocus />
      )}
      {!isBlock && <Input value={f.help ?? ""} onChange={(e) => onChange({ help: e.target.value || undefined })} placeholder="Help text (optional)" className="text-xs" />}
      {HAS_OPTIONS.includes(f.type) && (
        <div className="space-y-1.5">
          {(f.options ?? []).map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input value={o} onChange={(e) => onChange({ options: f.options!.map((x, j) => (j === i ? e.target.value : x)) })} />
              {f.type === "scale" && (
                <Input
                  type="number"
                  value={f.scores?.[i] ?? 0}
                  onChange={(e) => {
                    const scores = [...(f.scores ?? f.options!.map(() => 0))];
                    scores[i] = Number(e.target.value);
                    onChange({ scores });
                  }}
                  className="w-20"
                  title="Points"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ options: f.options!.filter((_, j) => j !== i), scores: f.scores?.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <button onClick={() => onChange({ options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`], scores: f.type === "scale" ? [...(f.scores ?? []), 0] : f.scores })} className="text-sm font-medium text-brand-700">
            + Add option
          </button>
        </div>
      )}
      {!isBlock && <Checkbox label="Required" checked={!!f.required} onChange={(e) => onChange({ required: e.target.checked })} />}
    </div>
  );
}
