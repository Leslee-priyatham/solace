"use client";

import { useActionState, useEffect, useState } from "react";
import { signup } from "../actions";
import { Field, Input, Notice, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";

const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IE", "Ireland"],
  ["IN", "India"],
  ["NZ", "New Zealand"],
  ["DE", "Germany"],
  ["OTHER", "Other"],
];

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  const [tz, setTz] = useState("America/New_York");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return (
    <form action={action} className="mt-6 space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <input type="hidden" name="timezone" value={tz} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <Input name="firstName" required autoFocus />
        </Field>
        <Field label="Last name">
          <Input name="lastName" required />
        </Field>
      </div>
      <Field label="Practice name">
        <Input name="practiceName" required placeholder="e.g. Riverside Counseling" />
      </Field>
      <Field label="Country">
        <Select name="country" defaultValue="US">
          {COUNTRIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Work email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full" pendingText="Creating workspace…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
