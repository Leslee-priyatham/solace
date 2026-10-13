"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import {
  Undo2, Redo2, Sparkles, ShieldCheck, Copy, PenLine, ThumbsUp, ThumbsDown, RefreshCw, Plus, User, Calendar, Video,
  Pencil, ArrowRight, Loader2, Lock, Send, FileText, Receipt, ShieldPlus,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Notice, Select, Textarea, cn, statusColor } from "@/components/ui";
import { Menu, Modal, useToast } from "@/components/client-ui";
import { RichText } from "@/components/rich-text";
import { clock, dateTime, duration, money, stripHtml, time } from "@/lib/format";
import { CAPTURE_MODE, CPT_CODES } from "@/lib/constants";
import type { LabeledUtterance } from "@/lib/ai/clinical";
import { Processing } from "./processing";
import { TranscriptDrawer } from "./transcript-drawer";
import {
  addBlankNote, addNote, deleteNote, deleteSession, editWithAssistant, rateSection, regenerateSection, retryProcessing, runCompliance,
  saveSection, shareWithClient, signNote, unsignNote, updateSessionDetails,
} from "./actions";

type Section = { id: string; title: string; html: string; rating?: "up" | "down" | null };
type Compliance = { score: number; summary: string; groupName: string; checkedAt: string; items: { criterionId: string; status: string; finding: string; suggestion: string }[] };
type Doc = { id: string; title: string; status: string; signedAt: string | null; signature: string | null; category: string; sections: Section[]; compliance: Compliance | null };
type SessionData = {
  id: string;
  title: string;
  status: string;
  error: string | null;
  captureMode: string;
  startedAt: string;
  durationSec: number;
  hasAudio: boolean;
  audioPath: string | null;
  rawText: string | null;
  transcript: LabeledUtterance[];
  chapters: { title: string; start: number }[];
  analytics: { providerSec?: number; clientSec?: number; silenceSec?: number };
  cpt: string | null;
  feeCents: number | null;
  billingType: string;
  isDemo: boolean;
  provider: string;
  client: { id: string; name: string; email: string | null; diagnoses: string[] } | null;
  invoices: { id: string; number: string; status: string }[];
  claims: { id: string; number: string; status: string }[];
};

export function SessionView({
  session,
  documents,
  templates,
  complianceGroups,
  clients,
  initialNoteId,
}: {
  session: SessionData;
  documents: Doc[];
  templates: { id: string; name: string; category: string }[];
  complianceGroups: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  initialNoteId?: string;
}) {
  const [activeId, setActiveId] = useState(initialNoteId && documents.some((d) => d.id === initialNoteId) ? initialNoteId : documents[0]?.id);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const active = documents.find((d) => d.id === activeId) ?? documents[0];
  const processing = ["TRANSCRIBING", "GENERATING", "RECORDING"].includes(session.status) && !documents.some((d) => d.status !== "GENERATING");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {session.isDemo && (
          <Notice tone="info" className="mb-4">
            This is a demo session with sample data so you can explore how notes work.
          </Notice>
        )}
        {processing || session.status === "ERROR" ? (
          <Processing sessionId={session.id} status={session.status} error={session.error} hasAudio={session.hasAudio} />
        ) : (
          <>
            <NoteTabs documents={documents} activeId={active?.id} onSelect={setActiveId} sessionId={session.id} templates={templates} />
            {active ? (
              <NotePanel key={active.id} doc={active} complianceGroups={complianceGroups} hasClient={!!session.client} />
            ) : (
              <Card className="p-10 text-center text-muted">No notes yet. Use + to add one from a template.</Card>
            )}
          </>
        )}
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Session details</h3>
            <Menu
              items={[
                { label: "Edit session", onClick: () => setEditOpen(true) },
                session.status === "READY" ? { label: "Regenerate all notes", onClick: () => confirm("Replace the current notes with newly generated ones?") && retryProcessing(session.id, true) } : null,
                session.hasAudio ? { label: "Re-transcribe recording", onClick: () => confirm("Transcribe the recording again and rewrite the notes?") && retryProcessing(session.id, false) } : null,
                session.audioPath ? { label: "Download recording", href: `/api/files/${session.audioPath}?download=1` } : null,
                { label: "Delete session", danger: true, onClick: async () => confirm("Delete this session, its recording and its notes?") && (await deleteSession(session.id)) },
              ]}
            />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 size-4 text-muted" />
              {session.client ? (
                <div>
                  <Link href={`/clients/${session.client.id}`} className="font-medium hover:text-brand-700">
                    {session.client.name}
                  </Link>
                  {session.client.email && <div className="text-muted">{session.client.email}</div>}
                </div>
              ) : (
                <button onClick={() => setEditOpen(true)} className="font-medium text-brand-700">
                  Assign a client
                </button>
              )}
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 size-4 text-muted" />
              <div>
                {dateTime(session.startedAt)}
                {session.durationSec > 0 && ` – ${time(new Date(new Date(session.startedAt).getTime() + session.durationSec * 1000))}`}
                {session.durationSec > 0 && <div className="text-muted">{duration(session.durationSec)}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Video className="size-4 text-muted" />
              {CAPTURE_MODE[session.captureMode as keyof typeof CAPTURE_MODE]} · {session.provider}
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Edit session
          </Button>
        </Card>

        {session.transcript.length > 0 && (
          <Card className="p-5">
            <h3 className="font-semibold">Transcript</h3>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{clock(session.durationSec || session.transcript[session.transcript.length - 1].end)}</div>
            <div className="text-sm text-muted">{new Set(session.transcript.map((u) => u.speaker)).size} speakers · {session.chapters.length} chapters</div>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setTranscriptOpen(true)}>
              View transcript <ArrowRight className="size-4" />
            </Button>
          </Card>
        )}
        {session.rawText && !session.transcript.length && (
          <Card className="p-5">
            <h3 className="mb-2 font-semibold">Your summary</h3>
            <p className="line-clamp-[10] whitespace-pre-wrap text-sm text-muted">{session.rawText}</p>
          </Card>
        )}

        {session.transcript.length > 0 && <Analytics a={session.analytics} clientName={session.client?.name.split(" ")[0] ?? "Client"} />}

        <Card className="p-5">
          <h3 className="mb-3 font-semibold">Billing</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Billing</span>
              <span>{session.billingType === "INSURANCE" ? "Insurance" : session.billingType === "NONE" ? "Not billable" : "Self-pay"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Service code</span>
              <span>{session.cpt ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Fee</span>
              <span>{session.feeCents != null ? money(session.feeCents) : "—"}</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {session.invoices.map((i) => (
              <Link key={i.id} href={`/billing/invoices/${i.id}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                <span className="flex items-center gap-2">
                  <Receipt className="size-4 text-muted" /> Invoice {i.number}
                </span>
                <Badge color={statusColor(i.status)}>{i.status.toLowerCase()}</Badge>
              </Link>
            ))}
            {session.claims.map((c) => (
              <Link key={c.id} href={`/insurance/claims/${c.id}`} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm hover:bg-canvas">
                <span className="flex items-center gap-2">
                  <ShieldPlus className="size-4 text-muted" /> Claim {c.number}
                </span>
                <Badge color={statusColor(c.status)}>{c.status.toLowerCase()}</Badge>
              </Link>
            ))}
          </div>
          {session.client && session.billingType !== "NONE" && session.invoices.length === 0 && session.claims.length === 0 && (
            <div className="mt-3 flex gap-2">
              {session.billingType === "INSURANCE" ? (
                <Link href={`/insurance/claims/new?client=${session.client.id}&session=${session.id}`} className="text-sm font-medium text-brand-700">
                  Create claim →
                </Link>
              ) : (
                <Link href={`/billing/invoices/new?client=${session.client.id}&session=${session.id}`} className="text-sm font-medium text-brand-700">
                  Create invoice →
                </Link>
              )}
            </div>
          )}
        </Card>
      </aside>

      <TranscriptDrawer
        open={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        sessionId={session.id}
        transcript={session.transcript}
        chapters={session.chapters}
        audioUrl={session.audioPath ? `/api/files/${session.audioPath}` : null}
        clientName={session.client?.name.split(" ")[0] ?? "Client"}
        providerName={session.provider}
        durationSec={session.durationSec}
      />
      {editOpen && <EditSessionModal session={session} clients={clients} onClose={() => setEditOpen(false)} />}
    </div>
  );
}

function NoteTabs({ documents, activeId, onSelect, sessionId, templates }: { documents: Doc[]; activeId?: string; onSelect: (id: string) => void; sessionId: string; templates: { id: string; name: string; category: string }[] }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-white p-1.5 ring-1 ring-line">
      {documents.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d.id)}
          className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium", d.id === activeId ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "text-muted hover:bg-canvas")}
        >
          {d.status === "GENERATING" && <Loader2 className="size-3.5 animate-spin" />}
          {d.status === "SIGNED" && <Lock className="size-3.5" />}
          {d.title}
        </button>
      ))}
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-canvas" title="Add another note">
        <Plus className="size-4" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a note to this session"
        description="Generate another document from the same session — for example a treatment plan update or a recap for your client."
        footer={
          <>
            <Button
              variant="outline"
              disabled={!templateId || pending}
              onClick={() =>
                start(async () => {
                  await addBlankNote(sessionId, templateId);
                  setOpen(false);
                })
              }
            >
              Start blank
            </Button>
            <Button
              disabled={!templateId || pending}
              onClick={() =>
                start(async () => {
                  const r = await addNote(sessionId, templateId);
                  if (r.error) toast(r.error, "error");
                  setOpen(false);
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Generate with AI
            </Button>
          </>
        }
      >
        <Field label="Template">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>
    </div>
  );
}

function NotePanel({ doc, complianceGroups, hasClient }: { doc: Doc; complianceGroups: { id: string; name: string }[]; hasClient: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const lastEditor = useRef<Editor | null>(null);
  const [sections, setSections] = useState(doc.sections);
  const [saving, setSaving] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [declined, setDeclined] = useState<string[]>([]);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [pending, start] = useTransition();
  const signed = doc.status === "SIGNED";
  const isClientNote = doc.category === "CLIENT_NOTE";

  const plainText = useMemo(() => sections.map((s) => `${s.title}\n${stripHtml(s.html)}`).join("\n\n"), [sections]);

  const save = async (sectionId: string, html: string) => {
    setSections((ss) => ss.map((s) => (s.id === sectionId ? { ...s, html } : s)));
    setSaving(true);
    const r = await saveSection(doc.id, sectionId, html);
    setSaving(false);
    if (r.error) toast(r.error, "error");
  };

  if (doc.status === "GENERATING") {
    return (
      <Card className="flex items-center justify-center gap-3 p-16 text-muted">
        <Loader2 className="size-5 animate-spin" /> Writing {doc.title}…
      </Card>
    );
  }
  if (doc.status === "ERROR") {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted">This note couldn't be generated.</p>
        <Button variant="outline" className="mt-4" onClick={() => start(async () => void (await deleteNote(doc.id)))}>
          Remove it
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="no-print flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        <button disabled={signed} onClick={() => lastEditor.current?.commands.undo()} className="rounded p-2 text-muted hover:bg-black/5 disabled:opacity-40" title="Undo">
          <Undo2 className="size-4" />
        </button>
        <button disabled={signed} onClick={() => lastEditor.current?.commands.redo()} className="rounded p-2 text-muted hover:bg-black/5 disabled:opacity-40" title="Redo">
          <Redo2 className="size-4" />
        </button>
        <Button variant="ghost" size="sm" disabled={signed} onClick={() => setAssistantOpen(true)}>
          <Sparkles className="size-4 text-brand-600" /> Edit with Assistant
        </Button>
        <span className="ml-1 text-xs text-muted">{saving ? "Saving…" : signed ? "" : "Saved"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Menu
            items={[
              { label: "Print / save as PDF", onClick: () => window.print() },
              isClientNote && hasClient ? { label: "Send to client via secure message", onClick: () => start(async () => toast((await shareWithClient(doc.id)).error ?? "Sent to client")) } : null,
              !signed ? { label: "Delete this note", danger: true, onClick: () => confirm("Delete this note?") && start(async () => void (await deleteNote(doc.id))) } : null,
            ]}
          />
          {!isClientNote && (
            <Button variant="outline" size="sm" onClick={() => setComplianceOpen(true)}>
              <ShieldCheck className={cn("size-4", doc.compliance && (doc.compliance.score >= 85 ? "text-emerald-600" : "text-amber-600"))} />
              Compliance{doc.compliance ? ` ${doc.compliance.score}%` : ""}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(plainText);
              toast("Note copied");
            }}
          >
            <Copy className="size-4" /> Copy
          </Button>
          {isClientNote && hasClient && (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => toast((await shareWithClient(doc.id)).error ?? "Sent to client"))}>
              <Send className="size-4" /> Send
            </Button>
          )}
          {signed ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => confirm("Unsign this note to make changes? The change is recorded in the audit log.") && start(async () => void (await unsignNote(doc.id)))}>
              <Lock className="size-4" /> Unsign
            </Button>
          ) : (
            <Button size="sm" disabled={pending} onClick={() => start(async () => void (await signNote(doc.id)))}>
              <PenLine className="size-4" /> Sign note
            </Button>
          )}
        </div>
      </div>

      <div className="px-8 py-6">
        <h2 className="mb-5 text-2xl font-semibold">{doc.title}</h2>
        <div className="space-y-7">
          {sections.map((s) => (
            <SectionBlock key={s.id} docId={doc.id} section={s} signed={signed} onSave={save} onFocusEditor={(e) => (lastEditor.current = e)} onReplace={(html) => setSections((ss) => ss.map((x) => (x.id === s.id ? { ...x, html } : x)))} />
          ))}
        </div>
        {signed && (
          <div className="mt-8 flex items-center gap-2 border-t border-line pt-4 text-sm text-muted">
            <Lock className="size-4" /> Signed electronically by {doc.signature} on {dateTime(doc.signedAt)}
          </div>
        )}
      </div>

      <Modal
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        title="Edit with Assistant"
        description="Describe the change. The assistant edits only what's needed and checks facts against the session."
        footer={
          <Button
            disabled={!instruction.trim() || pending}
            onClick={() =>
              start(async () => {
                const r = await editWithAssistant(doc.id, instruction);
                if (r.error) toast(r.error, "error");
                else if (r.declined?.length) {
                  // Keep the dialog open so the clinician can read what wasn't applied and why.
                  setDeclined(r.declined);
                  toast(r.changed ? "Note updated — some changes weren't applied" : "No changes applied", r.changed ? "success" : "error");
                  if (r.changed) router.refresh();
                } else {
                  toast(r.changed ? "Note updated" : "Nothing needed changing");
                  setAssistantOpen(false);
                  setInstruction("");
                  setDeclined([]);
                  router.refresh();
                }
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Apply edit
          </Button>
        }
      >
        <Textarea rows={4} value={instruction} onChange={(e) => (setInstruction(e.target.value), setDeclined([]))} placeholder="e.g. Make the assessment more concise and add the PHQ-9 score from the session" autoFocus />
        <DeclinedNotice items={declined} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Make it more concise", "Use more objective language", "Add direct client quotes", "Expand the interventions with rationale", "Write in first person"].map((p) => (
            <button key={p} onClick={() => setInstruction(p)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-canvas">
              {p}
            </button>
          ))}
        </div>
      </Modal>

      <ComplianceModal open={complianceOpen} onClose={() => setComplianceOpen(false)} doc={doc} groups={complianceGroups} />
    </Card>
  );
}

function SectionBlock({
  docId,
  section,
  signed,
  onSave,
  onFocusEditor,
  onReplace,
}: {
  docId: string;
  section: Section;
  signed: boolean;
  onSave: (id: string, html: string) => void;
  onFocusEditor: (e: Editor) => void;
  onReplace: (html: string) => void;
}) {
  const [rating, setRating] = useState(section.rating ?? null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [declined, setDeclined] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <section className="group">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{section.title}</h3>
        <div className="no-print flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
          <button
            title="Good"
            onClick={async () => {
              const next = rating === "up" ? null : "up";
              setRating(next);
              await rateSection(docId, section.id, next);
            }}
            className={cn("rounded p-1.5 hover:bg-black/5", rating === "up" && "text-brand-700")}
          >
            <ThumbsUp className="size-4" />
          </button>
          <button
            title="Needs work"
            onClick={async () => {
              const next = rating === "down" ? null : "down";
              setRating(next);
              await rateSection(docId, section.id, next);
              if (next === "down" && !signed) setRegenOpen(true);
            }}
            className={cn("rounded p-1.5 hover:bg-black/5", rating === "down" && "text-red-600")}
          >
            <ThumbsDown className="size-4" />
          </button>
          {!signed && (
            <button title="Regenerate section" onClick={() => setRegenOpen(true)} className="rounded p-1.5 hover:bg-black/5">
              <RefreshCw className={cn("size-4", pending && "animate-spin")} />
            </button>
          )}
          <button
            title="Copy section"
            onClick={async () => {
              await navigator.clipboard.writeText(stripHtml(section.html));
              toast(`${section.title} copied`);
            }}
            className="rounded p-1.5 hover:bg-black/5"
          >
            <Copy className="size-4" />
          </button>
        </div>
      </div>
      <RichText value={section.html} editable={!signed} onChange={(html) => onSave(section.id, html)} onFocusEditor={onFocusEditor} />
      <Modal
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        title={`Regenerate “${section.title}”`}
        description="Optionally say what should change. Leave blank to rewrite from the session."
        footer={
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await regenerateSection(docId, section.id, instruction);
                if (r.error) toast(r.error, "error");
                else if (r.declined?.length) {
                  setDeclined(r.declined);
                  toast("Not applied — see why below", "error");
                } else if (r.html) {
                  setDeclined([]);
                  onReplace(r.html);
                  setRating(null);
                  setRegenOpen(false);
                  setInstruction("");
                }
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Regenerate
          </Button>
        }
      >
        <Textarea rows={3} value={instruction} onChange={(e) => (setInstruction(e.target.value), setDeclined([]))} placeholder="e.g. Mention the breathing exercise and keep it under 80 words" />
        <DeclinedNotice items={declined} />
      </Modal>
    </section>
  );
}

/** AI edits that were refused because the session record doesn't support them. */
function DeclinedNotice({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <Notice tone="warn" className="mt-3">
      <p className="font-medium">Not applied — the session doesn't support this:</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">If you know it from outside the session, you can type it into the note yourself.</p>
    </Notice>
  );
}

function ComplianceModal({ open, onClose, doc, groups }: { open: boolean; onClose: () => void; doc: Doc; groups: { id: string; name: string }[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const c = doc.compliance;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Compliance check"
      description="Reviews this note against payer documentation criteria. Not legal advice — always review the result."
      footer={
        <div className="flex w-full items-center gap-2">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="max-w-xs">
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
          <Button
            className="ml-auto"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await runCompliance(doc.id, groupId);
                if (r.error) toast(r.error, "error");
                else router.refresh();
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} {c ? "Check again" : "Run check"}
          </Button>
        </div>
      }
    >
      {!c ? (
        <p className="text-sm text-muted">No check has been run on this note yet.</p>
      ) : (
        <div>
          <div className="flex items-center gap-4">
            <div className={cn("flex size-16 items-center justify-center rounded-full text-xl font-semibold", c.score >= 85 ? "bg-emerald-50 text-emerald-700" : c.score >= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700")}>
              {c.score}%
            </div>
            <div>
              <div className="font-medium">{c.groupName}</div>
              <p className="text-sm text-muted">{c.summary}</p>
            </div>
          </div>
          <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
            {c.items.map((i) => (
              <li key={i.criterionId} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge color={statusColor(i.status)}>{i.status === "pass" ? "Meets" : i.status === "warn" ? "Partial" : "Missing"}</Badge>
                  <span className="text-sm font-medium">{i.criterionId.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{i.finding}</p>
                {i.suggestion && <p className="mt-1 text-sm text-brand-800">→ {i.suggestion}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function Analytics({ a, clientName }: { a: { providerSec?: number; clientSec?: number; silenceSec?: number }; clientName: string }) {
  const p = a.providerSec ?? 0;
  const c = a.clientSec ?? 0;
  const s = a.silenceSec ?? 0;
  const total = p + c + s || 1;
  const rows = [
    { label: clientName, value: c, color: "#13ad90" },
    { label: "You", value: p, color: "#0e4a42" },
    { label: "Silence", value: s, color: "#e3e8e7" },
  ];
  let offset = 0;
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold">Analytics</h3>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 42 42" className="size-24 -rotate-90">
          {rows.map((r) => {
            const pct = (r.value / total) * 100;
            const el = <circle key={r.label} cx="21" cy="21" r="15.9" fill="none" stroke={r.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset} />;
            offset += pct;
            return el;
          })}
        </svg>
        <div className="flex-1 space-y-1.5 text-sm">
          <div className="text-xs font-semibold text-muted">Talking ratio</div>
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: r.color }} /> {r.label}
              </span>
              <span className="tabular-nums text-muted">
                {Math.round(r.value / 60)} min · {Math.round((r.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function EditSessionModal({ session, clients, onClose }: { session: SessionData; clients: { id: string; name: string }[]; onClose: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState(session.client?.id ?? "");
  const [title, setTitle] = useState(session.title);
  const [when, setWhen] = useState(() => {
    const d = new Date(session.startedAt);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [minutes, setMinutes] = useState(String(Math.round(session.durationSec / 60)));
  const [mode, setMode] = useState(session.captureMode);
  const [cpt, setCpt] = useState(session.cpt ?? "");
  const [fee, setFee] = useState(session.feeCents != null ? (session.feeCents / 100).toFixed(2) : "");
  const [billingType, setBillingType] = useState(session.billingType);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit session"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await updateSessionDetails(session.id, {
                  clientId: clientId || null,
                  title,
                  startedAt: new Date(when).toISOString(),
                  durationMin: Number(minutes) || 0,
                  captureMode: mode,
                  cpt,
                  feeCents: fee ? Math.round(Number(fee) * 100) : null,
                  billingType,
                });
                toast("Session updated");
                onClose();
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client" className="sm:col-span-2">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Unassigned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Started">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label="Duration (minutes)">
          <Input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Session type">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {Object.entries(CAPTURE_MODE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Billing">
          <Select value={billingType} onChange={(e) => setBillingType(e.target.value)}>
            <option value="SELF_PAY">Self-pay</option>
            <option value="INSURANCE">Insurance</option>
            <option value="NONE">Not billable</option>
          </Select>
        </Field>
        <Field label="Service code (CPT)">
          <Select value={cpt} onChange={(e) => setCpt(e.target.value)}>
            <option value="">None</option>
            {CPT_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fee">
          <Input type="number" step="0.01" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0.00" />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <FileText className="size-3.5" /> Changing the client also moves this session's notes to that client's record.
      </div>
    </Modal>
  );
}
