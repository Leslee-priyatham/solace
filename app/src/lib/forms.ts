import { severity } from "./library";

export type FormField = {
  id: string;
  type: string;
  label: string;
  help?: string;
  required?: boolean;
  options?: string[];
  scores?: number[];
};

export type Answers = Record<string, string | string[]>;

/** Total of all scored-scale answers (PHQ-9, GAD-7 and custom scored forms). */
export function scoreAnswers(fields: FormField[], answers: Answers): number | null {
  const scored = fields.filter((f) => f.type === "scale" && f.scores?.length);
  if (!scored.length) return null;
  return scored.reduce((sum, f) => {
    const idx = f.options?.indexOf(String(answers[f.id] ?? "")) ?? -1;
    return sum + (idx >= 0 ? f.scores![idx] ?? 0 : 0);
  }, 0);
}

export function validateAnswers(fields: FormField[], answers: Answers): string | null {
  for (const f of fields) {
    if (!f.required || ["heading", "paragraph"].includes(f.type)) continue;
    const v = answers[f.id];
    if (v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0)) return `Please answer: ${f.label}`;
    if (f.type === "yes_no" && f.required && f.label.toLowerCase().includes("consent") && v !== "Yes") return `Consent is required: ${f.label}`;
  }
  return null;
}

export function measureResult(measure: string | null, fields: FormField[], answers: Answers) {
  if (!measure) return null;
  const score = scoreAnswers(fields, answers);
  if (score === null) return null;
  return { score, severity: severity(measure, score) };
}
