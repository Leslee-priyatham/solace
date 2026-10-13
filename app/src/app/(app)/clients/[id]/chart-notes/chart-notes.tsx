"use client";

import { useState, useTransition } from "react";
import { NotebookPen, Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { RichText } from "@/components/rich-text";
import { date } from "@/lib/format";
import { deleteChartNote, saveChartNote } from "../../actions";

type Note = { id: string; title: string; html: string; date: string; author: string | null; updatedAt: string };

const QUICK_TITLES = ["No-show", "Late cancellation", "Phone call", "Collateral contact", "Administrative update", "Coordination of care"];

export function ChartNotes({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<NotebookPen className="size-6" />}
            title="Chart notes"
            description="Keep track of details outside of sessions: administrative changes, no-shows, collateral information, phone calls and anything else that comes up."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus className="size-4" /> New chart note
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New chart note
            </Button>
          </div>
          {notes.map((n) => (
            <Card key={n.id} className="p-5">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="text-xs text-muted">
                    {date(n.date)}
                    {n.author && ` · ${n.author}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(n)} className="rounded p-1.5 text-muted hover:bg-black/5" title="Edit">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => confirm("Delete this chart note?") && start(async () => void (await deleteChartNote(clientId, n.id)))}
                    disabled={pending}
                    className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="prose-note" dangerouslySetInnerHTML={{ __html: n.html }} />
            </Card>
          ))}
        </>
      )}
      {editing && <ChartNoteModal clientId={clientId} note={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ChartNoteModal({ clientId, note, onClose }: { clientId: string; note: Note | null; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [html, setHtml] = useState(note?.html ?? "");
  const [when, setWhen] = useState((note?.date ?? new Date().toISOString()).slice(0, 10));
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={note ? "Edit chart note" : "New chart note"}
      footer={
        <Button
          disabled={pending || !html.replace(/<[^>]+>/g, "").trim()}
          onClick={() =>
            start(async () => {
              await saveChartNote(clientId, { id: note?.id, title, html, date: when });
              toast("Chart note saved");
              onClose();
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} list="chart-titles" placeholder="e.g. Phone call with client" />
            <datalist id="chart-titles">
              {QUICK_TITLES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Date">
            <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TITLES.map((t) => (
            <button key={t} type="button" onClick={() => setTitle(t)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-canvas">
              {t}
            </button>
          ))}
        </div>
        <div className="min-h-40 rounded-lg border border-line px-3 py-2">
          <RichText value={html} onChange={setHtml} toolbar debounceMs={150} placeholder="What happened?" />
        </div>
      </div>
    </Modal>
  );
}
