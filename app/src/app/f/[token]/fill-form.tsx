"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { FormRenderer } from "@/components/form-renderer";
import type { Answers, FormField } from "@/lib/forms";
import { submitForm } from "./actions";

export function FillForm({
  token,
  title,
  description,
  fields,
  initial,
  completed,
  portalHref,
}: {
  token: string;
  title: string;
  description: string | null;
  fields: FormField[];
  initial: Answers;
  completed: boolean;
  portalHref: string;
}) {
  const [answers, setAnswers] = useState<Answers>(initial ?? {});
  const [done, setDone] = useState(completed);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const timer = useRef<number | null>(null);

  // Autosave progress so clients can come back later.
  useEffect(() => {
    if (done) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      if (Object.keys(answers).length) {
        await submitForm(token, answers, false);
        setSaved(true);
      }
    }, 1500);
  }, [answers, token, done]);

  if (done) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-4 text-xl font-semibold">Thank you — “{title}” is complete</h1>
        <p className="mt-1 text-muted">Your clinician will see your responses securely.</p>
        <Link href={portalHref} className="mt-6 inline-block font-medium text-brand-700">
          Back to your portal →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && <p className="mt-1 text-muted">{description}</p>}
      <div className="mt-8">
        <FormRenderer
          fields={fields}
          answers={answers}
          onChange={(id, v) => {
            setSaved(false);
            setAnswers((a) => ({ ...a, [id]: v }));
          }}
        />
      </div>
      {error && (
        <Notice tone="error" className="mt-6">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center gap-3 border-t border-line pt-6">
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await submitForm(token, answers, true);
              if (r.error) setError(r.error);
              else setDone(true);
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Submit
        </Button>
        <span className="text-sm text-muted">{saved ? "Progress saved" : ""}</span>
      </div>
    </div>
  );
}
