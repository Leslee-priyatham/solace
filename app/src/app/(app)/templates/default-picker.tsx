"use client";

import { useTransition } from "react";
import { Field, Select } from "@/components/ui";
import { useToast } from "@/components/client-ui";
import { setDefaultTemplate } from "./actions";

export function DefaultPicker({
  kind,
  label,
  value,
  options,
  fallback,
}: {
  kind: "defaultTemplateId" | "coupleTemplateId" | "clientNoteTemplateId";
  label: string;
  value: string;
  options: { id: string; name: string }[];
  fallback: string;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Field label={label}>
      <Select
        defaultValue={value}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setDefaultTemplate(kind, e.target.value || null);
            toast("Default updated");
          })
        }
      >
        <option value="">{fallback}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
