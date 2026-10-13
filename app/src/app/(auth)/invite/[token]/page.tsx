"use client";

import { use, useActionState } from "react";
import { acceptInvite } from "../../actions";
import { Field, Input, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, action] = useActionState(acceptInvite, undefined);
  return (
    <>
      <h1 className="text-2xl font-semibold">Join your team</h1>
      <p className="mt-1 text-sm text-muted">Choose a password to activate your account.</p>
      <form action={action} className="mt-6 space-y-4">
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <input type="hidden" name="token" value={token} />
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" required minLength={8} autoFocus />
        </Field>
        <SubmitButton className="w-full">Activate account</SubmitButton>
      </form>
    </>
  );
}
