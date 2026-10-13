"use client";

import { FormRenderer } from "@/components/form-renderer";
import type { Answers, FormField } from "@/lib/forms";

export function ReadOnlyForm({ fields, answers }: { fields: FormField[]; answers: Answers }) {
  return <FormRenderer fields={fields} answers={answers} readOnly />;
}
