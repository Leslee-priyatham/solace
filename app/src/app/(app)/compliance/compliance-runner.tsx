"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FileText, Loader2, ShieldCheck, Lock } from "lucide-react";
import { Button, Card, Field, Notice, Select, cn } from "@/components/ui";
import { checkExistingNote, checkUploadedNote } from "./actions";

export function ComplianceRunner({ groups, notes }: { groups: { id: string; name: string; description: string | null }[]; notes: { id: string; label: string }[] }) {
  const router = useRouter();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [mode, setMode] = useState<"upload" | "note">(notes.length ? "note" : "upload");
  const [file, setFile] = useState<File | null>(null);
  const [noteId, setNoteId] = useState(notes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const group = groups.find((g) => g.id === groupId);

  const run = () =>
    start(async () => {
      setError(null);
      let r;
      if (mode === "upload") {
        const form = new FormData();
        form.append("groupId", groupId);
        if (file) form.append("file", file);
        r = await checkUploadedNote(form);
      } else {
        r = await checkExistingNote(noteId, groupId);
      }
      if (r.error) setError(r.error);
      else router.push(`/compliance?check=${r.id}`);
    });

  return (
    <Card className="space-y-5 p-6">
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="1. Select criteria" hint={group?.description ?? "Criteria groups are based on common payer documentation standards. Add your own in Settings → Compliance checker."}>
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <div className="mb-1.5 text-sm font-medium">2. Choose the note</div>
        <div className="mb-3 flex gap-1 rounded-lg bg-canvas p-1">
          {notes.length > 0 && (
            <button onClick={() => setMode("note")} className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", mode === "note" ? "bg-white shadow-sm" : "text-muted")}>
              <FileText className="mr-1.5 inline size-4" /> One of my notes
            </button>
          )}
          <button onClick={() => setMode("upload")} className={cn("flex-1 rounded-md py-1.5 text-sm font-medium", mode === "upload" ? "bg-white shadow-sm" : "text-muted")}>
            <FileUp className="mr-1.5 inline size-4" /> Upload a PDF
          </button>
        </div>
        {mode === "note" ? (
          <Select value={noteId} onChange={(e) => setNoteId(e.target.value)}>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </Select>
        ) : (
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line px-6 py-8 text-center hover:bg-canvas">
            <FileUp className="mb-2 size-8 text-brand-600" />
            <span className="font-medium">{file ? file.name : "Browse your device, or drop a file here"}</span>
            <span className="text-sm text-muted">PDF or text files, up to 50 MB</span>
            <input type="file" accept="application/pdf,text/plain" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={run} disabled={pending || !groupId || (mode === "upload" ? !file : !noteId)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Run compliance check
        </Button>
        {mode === "upload" && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> Uploaded notes are read in memory and not stored.
          </span>
        )}
      </div>
    </Card>
  );
}
