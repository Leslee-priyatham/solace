"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { Field, Input, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
