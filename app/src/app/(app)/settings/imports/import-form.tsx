"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { Button, Card, CardHeader, Notice } from "@/components/ui";
import { importClientsCsv, previewCsv } from "./actions";

type Preview = { headers: string[]; mapped: Record<string, string>; sample: string[][]; total: number };

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [pending, start] = useTransition();

  const choose = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    if (!f) return;
    const form = new FormData();
    form.append("file", f);
    start(async () => {
      const r = await previewCsv(form);
      if ("error" in r && r.error) setError(r.error);
      else setPreview(r as Preview);
    });
  };

  return (
    <Card>
      <CardHeader title="Import clients from CSV" description="Export clients from your current system as CSV. We match columns like First name, Last name, Email, Phone, Date of birth, Diagnosis." />
      <div className="space-y-4 p-5">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line px-5 py-6 hover:bg-canvas">
          <FileSpreadsheet className="size-8 text-brand-600" />
          <div>
            <div className="font-medium">{file ? file.name : "Choose a .csv file"}</div>
            <div className="text-sm text-muted">Clients with an email that already exists are skipped.</div>
          </div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        {preview && !result && (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{preview.total} rows.</span> Matched columns:{" "}
              {Object.entries(preview.mapped).map(([k, v]) => (
                <span key={k} className="mr-2 inline-block rounded bg-brand-50 px-1.5 text-xs text-brand-800">
                  {k} ← {v}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas">
                    {preview.headers.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {r.map((c, j) => (
                        <td key={j} className="px-2 py-1.5">
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const form = new FormData();
                  form.append("file", file!);
                  const r = await importClientsCsv(form);
                  if (r.error) setError(r.error);
                  else setResult(r.summary ?? null);
                })
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Import {preview.total} clients
            </Button>
          </div>
        )}
        {result && (
          <Notice tone="success">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4" /> {result.created} clients imported, {result.skipped} duplicates skipped.
            </div>
            {result.errors.length > 0 && <ul className="mt-2 list-inside list-disc text-xs">{result.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}</ul>}
            <Link href="/clients" className="mt-2 inline-block font-medium underline">
              View clients
            </Link>
          </Notice>
        )}
      </div>
    </Card>
  );
}
