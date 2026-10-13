"use client";

import { Menu, useToast } from "@/components/client-ui";
import { remindRequest, revokeRequest } from "@/app/(app)/forms/actions";

export function RequestActions({ id, token, status }: { id: string; token: string; status: string }) {
  const toast = useToast();
  const open = status === "SENT" || status === "IN_PROGRESS";
  return (
    <Menu
      items={[
        { label: status === "COMPLETED" ? "View responses" : "View form", href: `/forms/requests/${id}` },
        open
          ? {
              label: "Copy direct link",
              onClick: async () => {
                await navigator.clipboard.writeText(`${location.origin}/f/${token}`);
                toast("Link copied");
              },
            }
          : null,
        open ? { label: "Fill in with client now", href: `/f/${token}` } : null,
        open ? { label: "Send reminder", onClick: async () => (await remindRequest(id), toast("Reminder sent")) } : null,
        open ? { label: "Revoke request", danger: true, onClick: async () => confirm("Revoke this form request?") && (await revokeRequest(id), toast("Request revoked")) } : null,
      ]}
    />
  );
}
