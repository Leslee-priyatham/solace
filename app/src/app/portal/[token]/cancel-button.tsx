"use client";

import { useState, useTransition } from "react";
import { Button, Notice, Textarea } from "@/components/ui";
import { Modal } from "@/components/client-ui";
import { cancelAppointment } from "./actions";

export function CancelButton({ token, appointmentId }: { token: string; appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-muted hover:text-red-600">
        Cancel
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this session?"
        description="Cancellations less than 24 hours before the session may incur a fee under your practice's policy."
        footer={
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelAppointment(token, appointmentId, reason);
                if (r.error) setError(r.error);
                else setOpen(false);
              })
            }
          >
            Cancel session
          </Button>
        }
      >
        {error && <Notice tone="error" className="mb-3">{error}</Notice>}
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
      </Modal>
    </>
  );
}
