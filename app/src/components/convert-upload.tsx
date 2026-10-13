"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FileText, Loader2 } from "lucide-react";
import { Button, Card, Notice } from "./ui";

/** Shared PDF → (form | note template) upload card. */
export function ConvertUpload({ action, redirectBase, cta }: { action: (form: FormData) => Promise<{ error?: string; id?: string }>; redirectBase: string; cta: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-2xl space-y-5 p-6">
      {error && <Notice tone="error">{error}</Notice>}
      <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line px-6 py-10 text-center hover:bg-canvas">
        {file ? <FileText className="mb-3 size-10 text-brand-600" /> : <FileUp className="mb-3 size-10 text-brand-600" />}
        <div className="font-medium">{file ? file.name : "Choose a PDF or .txt file"}</div>
        <div className="mt-1 text-sm text-muted">Text-based PDFs work best. Scanned images can't be read.</div>
        <input type="file" accept="application/pdf,text/plain" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Button
        disabled={!file || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const form = new FormData();
            form.append("file", file!);
            const r = await action(form);
            if (r.error) setError(r.error);
            else if (r.id) router.push(`${redirectBase}/${r.id}`);
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />} {pending ? "Converting… this can take a minute" : cta}
      </Button>
    </Card>
  );
}
