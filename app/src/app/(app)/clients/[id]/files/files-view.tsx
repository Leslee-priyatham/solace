"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud, FileText, FileImage, File as FileIcon, Download, Trash2, Loader2, Eye } from "lucide-react";
import { Card, Table, Td, Th } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { date } from "@/lib/format";
import { deleteClientFile, uploadClientFiles } from "../../actions";

type F = { id: string; name: string; mime: string; size: number; path: string; uploadedAt: string };

export function FilesView({ clientId, files }: { clientId: string; files: F[] }) {
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    const form = new FormData();
    Array.from(list).forEach((f) => form.append("files", f));
    start(async () => {
      const r = await uploadClientFiles(clientId, form);
      toast(r.error ?? `${list.length} file${list.length === 1 ? "" : "s"} uploaded`, r.error ? "error" : "success");
    });
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed bg-white px-6 py-10 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas"}`}
      >
        {pending ? <Loader2 className="mb-3 size-9 animate-spin text-brand-600" /> : <UploadCloud className="mb-3 size-9 text-brand-600" />}
        <div className="font-medium">Upload client files</div>
        <div className="mt-1 max-w-md text-sm text-muted">Store charts, assessments, releases and records from other systems. Drop files here or click to browse.</div>
        <input ref={input} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </label>
      {files.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Uploaded</Th>
              <Th>Size</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => {
              const Icon = f.mime.startsWith("image/") ? FileImage : f.mime.includes("pdf") || f.mime.startsWith("text/") ? FileText : FileIcon;
              return (
                <tr key={f.id}>
                  <Td>
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4 text-muted" />
                      {f.name}
                    </span>
                  </Td>
                  <Td className="text-muted">{date(f.uploadedAt)}</Td>
                  <Td className="text-muted">{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.ceil(f.size / 1024)} KB`}</Td>
                  <Td className="text-right">
                    <span className="inline-flex gap-1">
                      <a href={`/api/files/${f.path}`} target="_blank" rel="noreferrer" className="rounded p-1.5 text-muted hover:bg-black/5" title="Open">
                        <Eye className="size-4" />
                      </a>
                      <a href={`/api/files/${f.path}?download=1`} className="rounded p-1.5 text-muted hover:bg-black/5" title="Download">
                        <Download className="size-4" />
                      </a>
                      <button
                        onClick={() => confirm(`Delete ${f.name}?`) && start(async () => void (await deleteClientFile(clientId, f.id)))}
                        className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {files.length === 0 && <Card className="p-6 text-center text-sm text-muted">No files yet.</Card>}
    </div>
  );
}
