"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, Loader2, Copy, Archive, FlaskConical, Lock } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { NOTE_CATEGORY } from "@/lib/constants";
import type { TemplateSection } from "@/lib/ai/clinical";
import { archiveTemplate, copyTemplate, previewTemplate, saveTemplate } from "../actions";

const rid = () => Math.random().toString(36).slice(2, 10);
type T = { id: string; name: string; description: string; category: string; audience: string; guidance: string; sections: TemplateSection[]; isSystem: boolean };

export function TemplateEditor({ template, sessions }: { template: T; sessions: { id: string; label: string }[] }) {
  const [t, setT] = useState(template);
  const [dirty, setDirty] = useState(false);
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [preview, setPreview] = useState<{ id: string; title: string; html: string }[] | null>(null);
  const [pending, start] = useTransition();
  const [previewing, startPreview] = useTransition();
  const toast = useToast();
  const ro = t.isSystem;

  const patch = (p: Partial<T>) => {
    setT((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const patchSection = (i: number, p: Partial<TemplateSection>) => patch({ sections: t.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= t.sections.length) return;
    const c = [...t.sections];
    [c[i], c[j]] = [c[j], c[i]];
    patch({ sections: c });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        {ro && (
          <Notice tone="info" className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <Lock className="size-4" /> This is a built-in template. Make a copy to customise it.
            </span>
            <form action={copyTemplate.bind(null, t.id)}>
              <Button size="sm">
                <Copy className="size-4" /> Make a copy
              </Button>
            </form>
          </Notice>
        )}
        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input value={t.name} disabled={ro} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={t.description} disabled={ro} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
          <Field label="Document type">
            <Select value={t.category} disabled={ro} onChange={(e) => patch({ category: e.target.value })}>
              {Object.entries(NOTE_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="For">
            <Select value={t.audience} disabled={ro} onChange={(e) => patch({ audience: e.target.value })}>
              <option value="INDIVIDUAL">Individuals</option>
              <option value="COUPLE">Couples</option>
              <option value="FAMILY">Families</option>
              <option value="ANY">Any session</option>
            </Select>
          </Field>
          <Field label="Overall guidance" hint="Style rules for the whole note, e.g. “Write in first person, keep each section under 120 words.”" className="sm:col-span-2">
            <Textarea rows={2} value={t.guidance} disabled={ro} onChange={(e) => patch({ guidance: e.target.value })} />
          </Field>
        </Card>

        <div className="space-y-3">
          {t.sections.map((s, i) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-2 w-6 text-sm font-medium text-muted">{i + 1}.</span>
                <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_160px]">
                  <Input value={s.title} disabled={ro} onChange={(e) => patchSection(i, { title: e.target.value })} placeholder="Section heading" className="font-medium" />
                  <Select value={s.format ?? "paragraph"} disabled={ro} onChange={(e) => patchSection(i, { format: e.target.value as TemplateSection["format"] })}>
                    <option value="paragraph">Paragraphs</option>
                    <option value="bullets">Bullet points</option>
                    <option value="short">One or two lines</option>
                  </Select>
                  <Textarea
                    rows={2}
                    value={s.instructions}
                    disabled={ro}
                    onChange={(e) => patchSection(i, { instructions: e.target.value })}
                    placeholder="What should go in this section?"
                    className="sm:col-span-2"
                  />
                </div>
                {!ro && (
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} className="rounded p-1 text-muted hover:bg-black/5">
                      <ArrowUp className="size-4" />
                    </button>
                    <button onClick={() => move(i, 1)} className="rounded p-1 text-muted hover:bg-black/5">
                      <ArrowDown className="size-4" />
                    </button>
                    <button onClick={() => patch({ sections: t.sections.filter((_, j) => j !== i) })} className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {!ro && (
            <Button variant="outline" onClick={() => patch({ sections: [...t.sections, { id: rid(), title: "", instructions: "", format: "paragraph" }] })}>
              <Plus className="size-4" /> Add section
            </Button>
          )}
        </div>

        {!ro && (
          <div className="flex gap-2">
            <Button
              disabled={!dirty || pending}
              onClick={() =>
                start(async () => {
                  const r = await saveTemplate(t.id, t);
                  if (r.error) toast(r.error, "error");
                  else {
                    toast("Template saved");
                    setDirty(false);
                  }
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} {dirty ? "Save template" : "Saved"}
            </Button>
            <form action={copyTemplate.bind(null, t.id)}>
              <Button variant="outline">
                <Copy className="size-4" /> Duplicate
              </Button>
            </form>
            <form action={archiveTemplate.bind(null, t.id)} onSubmit={(e) => !confirm("Archive this template?") && e.preventDefault()}>
              <Button variant="outline">
                <Archive className="size-4" /> Archive
              </Button>
            </form>
          </div>
        )}
      </div>

      <Card className="h-fit p-5 xl:sticky xl:top-6">
        <h3 className="flex items-center gap-2 font-semibold">
          <FlaskConical className="size-4 text-brand-600" /> Test with a real session
        </h3>
        <p className="mt-1 text-sm text-muted">Generate a preview from one of your sessions. Nothing is saved.</p>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm text-muted">You need at least one finished session to test with.</p>
        ) : (
          <>
            <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="mt-4">
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              className="mt-3 w-full"
              disabled={previewing || !sessionId}
              onClick={() =>
                startPreview(async () => {
                  const r = await previewTemplate({ name: t.name, guidance: t.guidance, sections: t.sections }, sessionId);
                  if (r.error) toast(r.error, "error");
                  else setPreview(r.sections ?? null);
                })
              }
            >
              {previewing && <Loader2 className="size-4 animate-spin" />} Generate preview
            </Button>
          </>
        )}
        {preview && (
          <div className="mt-5 max-h-[60vh] space-y-4 overflow-y-auto border-t border-line pt-4">
            {preview.map((s) => (
              <div key={s.id}>
                <h4 className="font-semibold">{s.title}</h4>
                <div className="prose-note text-sm" dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
