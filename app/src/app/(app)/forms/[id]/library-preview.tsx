"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";
import { FormRenderer } from "@/components/form-renderer";
import type { Answers, FormField } from "@/lib/forms";
import { useLibraryForm } from "../actions";

export function LibraryPreview({ id, fields }: { id: string; fields: FormField[] }) {
  const [answers, setAnswers] = useState<Answers>({});
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-6">
        <FormRenderer fields={fields} answers={answers} onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} />
      </Card>
      <Card className="h-fit p-5">
        <p className="text-sm text-muted">Add this template to your practice forms to customise it and send it to clients.</p>
        <form action={useLibraryForm.bind(null, id)} className="mt-4">
          <SubmitButton className="w-full">
            <Copy className="size-4" /> Use this template
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
