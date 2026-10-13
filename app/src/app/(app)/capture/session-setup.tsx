"use client";

import Link from "next/link";
import { Field, Select } from "@/components/ui";

export type CaptureOptions = {
  clients: { id: string; name: string; kind: string }[];
  templates: { id: string; name: string }[];
  appointment: { id: string; clientId: string | null; label: string } | null;
};

export function SessionSetup({
  options,
  clientId,
  setClientId,
  templateId,
  setTemplateId,
  disabled,
}: {
  options: CaptureOptions;
  clientId: string;
  setClientId: (v: string) => void;
  templateId: string;
  setTemplateId: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Client" hint={<Link href="/clients/new" className="text-brand-700">+ Add a new client</Link>}>
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={disabled || !!options.appointment}>
          <option value="">Assign later</option>
          {options.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.kind !== "INDIVIDUAL" ? ` (${c.kind.toLowerCase()})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note template" hint="Leave on default to use your note settings.">
        <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={disabled}>
          <option value="">Default template</option>
          {options.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Uploads the capture form with progress, resolving to the new session id. */
export function uploadSession(form: FormData, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/sessions");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body.id);
        else reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.send(form);
  });
}
