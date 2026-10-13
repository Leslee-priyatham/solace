"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, FileAudio, Receipt, ClipboardList, FileText, CornerDownLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "../ui";

type Result = { type: "client" | "session" | "invoice" | "form" | "template"; id: string; title: string; subtitle?: string; href: string };

const ICONS = { client: User, session: FileAudio, invoice: Receipt, form: ClipboardList, template: FileText };
const QUICK: Result[] = [
  { type: "client", id: "new-client", title: "Add a client", href: "/clients/new" },
  { type: "session", id: "new-note", title: "Write a note", href: "/capture/write" },
  { type: "session", id: "record", title: "Record an in-person session", href: "/capture/record?mode=IN_PERSON" },
  { type: "invoice", id: "new-invoice", title: "Create an invoice", href: "/billing/invoices/new" },
  { type: "template", id: "ai", title: "Set up AI providers", href: "/settings/ai" },
];

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) {
          setResults(await res.json());
          setActive(0);
        }
      } catch {}
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (!open || typeof document === "undefined") return null;
  const list = q.trim() ? results : QUICK;
  const go = (r: Result) => {
    setOpen(false);
    router.push(r.href);
  };

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && list[active]) go(list[active]);
            }}
            placeholder="Search clients, sessions, notes, invoices…"
            className="h-14 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {!q.trim() && <div className="px-4 pb-1 pt-1 text-xs font-medium text-muted">Quick actions</div>}
          {list.length === 0 && q.trim() && <div className="px-4 py-8 text-center text-sm text-muted">No matches for “{q}”.</div>}
          {list.map((r, i) => {
            const Icon = ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", i === active && "bg-brand-50")}
              >
                <Icon className="size-4 shrink-0 text-brand-700" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  {r.subtitle && <span className="block truncate text-xs text-muted">{r.subtitle}</span>}
                </span>
                {i === active && <CornerDownLeft className="size-4 text-muted" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
