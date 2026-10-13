"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { X, Loader2, MoreHorizontal } from "lucide-react";
import { Button, buttonClass, cn } from "./ui";

// ───────────── Modal ─────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("w-full rounded-2xl bg-white shadow-xl", width)} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-black/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** A button that opens a modal; children receive a close callback. */
export function ModalButton({
  label,
  title,
  description,
  variant = "primary",
  size,
  className,
  modalSize,
  children,
}: {
  label: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  modalSize?: "sm" | "md" | "lg" | "xl";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={close} title={title} description={description} size={modalSize}>
        {open && children(close)}
      </Modal>
    </>
  );
}

// ───────────── Forms ─────────────

export function SubmitButton({ children, pendingText, variant = "primary", size, className }: { children: ReactNode; pendingText?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"; size?: "sm" | "md" | "lg"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? pendingText ?? children : children}
    </Button>
  );
}

/** Runs a server action from a button, with optional confirmation and toast. */
export function ActionButton({
  action,
  children,
  confirm,
  success,
  variant = "outline",
  size = "sm",
  className,
  onDone,
}: {
  action: () => Promise<unknown>;
  children: ReactNode;
  confirm?: string;
  success?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  onDone?: (result: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          const result = await action();
          if (result && typeof result === "object" && "error" in result && result.error) {
            toast(String(result.error), "error");
          } else {
            if (success) toast(success);
            onDone?.(result);
          }
        } catch (e) {
          toast(e instanceof Error ? e.message : "Something went wrong", "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

// ───────────── Menu ─────────────

export function Menu({ items, label, align = "right" }: { items: ({ label: ReactNode; onClick?: () => void; href?: string; danger?: boolean } | null)[]; label?: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={buttonClass("outline", "sm", "px-2")} aria-label="More actions">
        {label ?? <MoreHorizontal className="size-4" />}
      </button>
      {open && (
        <div className={cn("absolute z-40 mt-1 min-w-48 rounded-lg border border-line bg-white py-1 shadow-lg", align === "right" ? "right-0" : "left-0")}>
          {items.filter(Boolean).map((item, i) =>
            item!.href ? (
              <a key={i} href={item!.href} className={cn("block px-3 py-2 text-sm hover:bg-canvas", item!.danger && "text-red-600")}>
                {item!.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item!.onClick?.();
                }}
                className={cn("block w-full px-3 py-2 text-left text-sm hover:bg-canvas", item!.danger && "text-red-600")}
              >
                {item!.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ───────────── Toasts ─────────────

type ToastFn = (message: string, tone?: "success" | "error") => void;
const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; tone: "success" | "error" }[]>([]);
  const push = useCallback<ToastFn>((message, tone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto max-w-lg rounded-lg px-4 py-2.5 text-sm text-white shadow-lg", t.tone === "error" ? "bg-red-600" : "bg-ink")}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const toast = useToast();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
      }}
    >
      {label}
    </Button>
  );
}
