"use client";

import { useRouter } from "next/navigation";
import { Printer, Send } from "lucide-react";
import { Button } from "@/components/ui";
import { ActionButton, Menu } from "@/components/client-ui";
import { deleteSuperbill, sendSuperbill } from "../../actions";

export function SuperbillActions({ id, sent }: { id: string; sent: boolean }) {
  const router = useRouter();
  return (
    <>
      <Menu items={[{ label: "Delete superbill", danger: true, onClick: async () => confirm("Delete this superbill?") && (await deleteSuperbill(id), router.push("/billing/superbills")) }]} />
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Print / PDF
      </Button>
      <ActionButton variant="primary" size="md" action={() => sendSuperbill(id)} success="Superbill shared with the client">
        <Send className="size-4" /> {sent ? "Resend to client" : "Send to client"}
      </ActionButton>
    </>
  );
}
