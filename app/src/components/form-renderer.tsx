"use client";

import type { FormField, Answers } from "@/lib/forms";
import { Input, Textarea, cn } from "./ui";

/** Renders form fields for filling in (or read-only when `readOnly`). */
export function FormRenderer({
  fields,
  answers,
  onChange,
  readOnly,
}: {
  fields: FormField[];
  answers: Answers;
  onChange?: (id: string, value: string | string[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-6">
      {fields.map((f, i) => {
        if (f.type === "heading") return <h3 key={f.id} className="border-b border-line pb-1 pt-2 text-lg font-semibold">{f.label}</h3>;
        if (f.type === "paragraph") return <p key={f.id} className="whitespace-pre-line text-sm leading-relaxed text-ink/80">{f.label}</p>;
        const value = answers[f.id];
        const set = (v: string | string[]) => onChange?.(f.id, v);
        const number = fields.slice(0, i + 1).filter((x) => !["heading", "paragraph"].includes(x.type)).length;
        return (
          <div key={f.id}>
            <div className="mb-2 text-sm font-medium">
              <span className="mr-1 text-muted">{number}.</span>
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
            </div>
            {f.help && <p className="-mt-1 mb-2 text-xs text-muted">{f.help}</p>}
            <FieldInput field={f} value={value} set={set} readOnly={readOnly} />
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({ field: f, value, set, readOnly }: { field: FormField; value: string | string[] | undefined; set: (v: string | string[]) => void; readOnly?: boolean }) {
  const str = typeof value === "string" ? value : "";
  if (readOnly && !["single_choice", "multi_choice", "scale", "yes_no"].includes(f.type)) {
    return <div className={cn("rounded-lg bg-canvas px-3 py-2 text-sm", !str && "text-muted")}>{f.type === "signature" && str ? <span className="font-serif text-lg italic">{str}</span> : str || "No answer"}</div>;
  }
  switch (f.type) {
    case "long_text":
      return <Textarea rows={4} value={str} onChange={(e) => set(e.target.value)} />;
    case "email":
      return <Input type="email" value={str} onChange={(e) => set(e.target.value)} />;
    case "phone":
      return <Input type="tel" value={str} onChange={(e) => set(e.target.value)} />;
    case "date":
      return <Input type="date" value={str} onChange={(e) => set(e.target.value)} className="max-w-52" />;
    case "number":
      return <Input type="number" value={str} onChange={(e) => set(e.target.value)} className="max-w-40" />;
    case "signature":
      return (
        <div>
          <Input value={str} onChange={(e) => set(e.target.value)} placeholder="Type your full name to sign" className="font-serif text-lg italic" />
          <p className="mt-1 text-xs text-muted">Typing your name counts as your electronic signature.</p>
        </div>
      );
    case "yes_no":
    case "single_choice":
    case "scale": {
      const options = f.type === "yes_no" ? ["Yes", "No"] : f.options ?? [];
      return (
        <div className={cn("flex gap-2", f.type === "scale" || options.length > 3 ? "flex-col sm:flex-row sm:flex-wrap" : "flex-wrap")}>
          {options.map((o, i) => (
            <label
              key={o}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                str === o ? "border-brand-500 bg-brand-50 text-brand-900" : "border-line hover:bg-canvas",
                readOnly && "cursor-default",
              )}
            >
              <input type="radio" className="accent-brand-600" checked={str === o} disabled={readOnly} onChange={() => set(o)} />
              {o}
              {f.type === "scale" && f.scores && <span className="text-xs text-muted">({f.scores[i]})</span>}
            </label>
          ))}
        </div>
      );
    }
    case "multi_choice": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((o) => (
            <label key={o} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", arr.includes(o) ? "border-brand-500 bg-brand-50" : "border-line hover:bg-canvas")}>
              <input type="checkbox" className="accent-brand-600" checked={arr.includes(o)} disabled={readOnly} onChange={() => set(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} />
              {o}
            </label>
          ))}
        </div>
      );
    }
    default:
      return <Input value={str} onChange={(e) => set(e.target.value)} />;
  }
}
