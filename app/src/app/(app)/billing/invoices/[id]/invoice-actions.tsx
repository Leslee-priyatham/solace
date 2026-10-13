"use client";

import { useState } from "react";
import { Printer, Send, Banknote, Pencil } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { ActionButton, Menu, useToast } from "@/components/client-ui";
import { PaymentModal } from "../../payments/payment-modal";
import { deleteInvoice, sendInvoice, setInvoiceStatus } from "../../actions";

export function InvoiceActions({ id, clientId, status, balanceCents, sent }: { id: string; clientId: string; status: string; balanceCents: number; sent: boolean }) {
  const [payOpen, setPayOpen] = useState(false);
  const toast = useToast();
  const open = ["SENT", "PARTIAL", "DRAFT"].includes(status);
  return (
    <>
      <Menu
        items={[
          status === "DRAFT" ? { label: "Delete draft", danger: true, onClick: async () => confirm("Delete this draft invoice?") && (await deleteInvoice(id)) } : null,
          open && status !== "DRAFT" ? { label: "Write off balance", onClick: async () => confirm("Write off the remaining balance?") && toast((await setInvoiceStatus(id, "WRITTEN_OFF")).error ?? "Written off") } : null,
          open ? { label: "Void invoice", danger: true, onClick: async () => confirm("Void this invoice?") && toast((await setInvoiceStatus(id, "VOID")).error ?? "Invoice voided") } : null,
          status === "VOID" || status === "WRITTEN_OFF" ? { label: "Reopen invoice", onClick: async () => toast((await setInvoiceStatus(id, "OPEN")).error ?? "Invoice reopened") } : null,
        ]}
      />
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" /> Print / PDF
      </Button>
      {status === "DRAFT" && (
        <ButtonLink href={`/billing/invoices/${id}/edit`} variant="outline">
          <Pencil className="size-4" /> Edit
        </ButtonLink>
      )}
      {open && (
        <ActionButton variant="outline" size="md" action={() => sendInvoice(id)} success="Invoice sent to the client portal">
          <Send className="size-4" /> {sent ? "Resend" : "Send"}
        </ActionButton>
      )}
      {open && balanceCents > 0 && (
        <Button onClick={() => setPayOpen(true)}>
          <Banknote className="size-4" /> Record payment
        </Button>
      )}
      {payOpen && <PaymentModal clientId={clientId} invoiceId={id} defaultAmountCents={balanceCents} onClose={() => setPayOpen(false)} />}
    </>
  );
}
