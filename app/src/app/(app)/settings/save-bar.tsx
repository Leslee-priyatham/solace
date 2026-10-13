"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/client-ui";

/** Save button that runs a server action and reports the result as a toast. */
export function SaveButton({ action, label = "Save", disabled }: { action: () => Promise<{ error?: string }>; label?: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      disabled={pending || disabled}
      onClick={() =>
        start(async () => {
          const r = await action();
          toast(r.error ?? "Saved", r.error ? "error" : "success");
        })
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" />} {label}
    </Button>
  );
}
