"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, ChevronDown, User, Monitor, PenLine, Upload, CalendarPlus, Video, ClipboardList, MessageSquare } from "lucide-react";
import { ButtonLink, buttonClass } from "@/components/ui";
import { Menu, useToast } from "@/components/client-ui";
import { deleteClient, regeneratePortalLink, setClientStatus } from "../actions";

export function ClientHeaderActions({ clientId, status, portalToken }: { clientId: string; status: string; portalToken: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const items = [
    { href: `/capture/record?mode=IN_PERSON&client=${clientId}`, label: "Record in-person", icon: User },
    { href: `/capture/record?mode=VIRTUAL&client=${clientId}`, label: "Capture virtual call", icon: Monitor },
    { href: `/telehealth/room?client=${clientId}`, label: "Start telehealth call", icon: Video },
    { href: `/capture/write?client=${clientId}`, label: "Write or dictate", icon: PenLine },
    { href: `/capture/upload?client=${clientId}`, label: "Upload recording", icon: Upload },
    { href: `/calendar?new=1&client=${clientId}`, label: "Schedule", icon: CalendarPlus },
  ];

  return (
    <>
      <Menu
        items={[
          {
            label: "Copy client portal link",
            onClick: async () => {
              await navigator.clipboard.writeText(`${location.origin}/portal/${portalToken}`);
              toast("Portal link copied");
            },
          },
          { label: "Send forms", href: `/clients/${clientId}/forms?send=1` },
          { label: "Message client", href: `/inbox?client=${clientId}` },
          { label: "Create invoice", href: `/billing/invoices/new?client=${clientId}` },
          { label: "Reset portal link", onClick: async () => confirm("The old portal link will stop working. Continue?") && (await regeneratePortalLink(clientId), toast("New portal link created")) },
          status === "DISCHARGED"
            ? { label: "Reactivate client", onClick: async () => (await setClientStatus(clientId, "ACTIVE"), toast("Client reactivated")) }
            : { label: "Discharge client", onClick: async () => confirm("Mark this client as discharged?") && (await setClientStatus(clientId, "DISCHARGED"), toast("Client discharged")) },
          {
            label: "Delete client",
            danger: true,
            onClick: async () => {
              if (!confirm("Permanently delete this client and all their sessions, notes and files? This can't be undone.")) return;
              const r = await deleteClient(clientId);
              if (r?.error) toast(r.error, "error");
            },
          },
        ]}
      />
      <ButtonLink href={`/clients/${clientId}/edit`} variant="outline">
        <Pencil className="size-4" /> Edit
      </ButtonLink>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((o) => !o)} className={buttonClass("primary", "md")}>
          New session <ChevronDown className="size-4" />
        </button>
        {open && (
          <div className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-line bg-white py-1.5 shadow-xl">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-canvas">
                <i.icon className="size-4 text-brand-700" /> {i.label}
              </Link>
            ))}
            <div className="my-1 border-t border-line" />
            <Link href={`/clients/${clientId}/forms?send=1`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-canvas">
              <ClipboardList className="size-4 text-brand-700" /> Send forms
            </Link>
            <Link href={`/inbox?client=${clientId}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-canvas">
              <MessageSquare className="size-4 text-brand-700" /> Message
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
