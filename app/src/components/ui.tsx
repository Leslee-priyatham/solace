import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cn };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100",
  outline: "border border-line bg-white text-ink hover:bg-canvas",
  ghost: "text-ink hover:bg-black/5",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return clsx(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={clsx("rounded-xl border border-line bg-white", className)} />;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; href?: string }[] }) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <nav className="mb-2 flex items-center gap-1.5 text-sm text-muted">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>›</span>}
              {b.href ? (
                <Link href={b.href} className="hover:text-ink">
                  {b.label}
                </Link>
              ) : (
                <span className="text-ink">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-canvas";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={clsx(inputBase, "h-9", className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={clsx(inputBase, "py-2", className)} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select {...props} className={clsx(inputBase, "h-9 pr-8", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className, required }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={clsx("flex items-center gap-2 text-sm", className)}>
      <input type="checkbox" {...props} className="size-4 rounded border-line accent-brand-600" />
      {label}
    </label>
  );
}

const BADGE: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-800",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ color = "gray", className, ...props }: ComponentProps<"span"> & { color?: keyof typeof BADGE }) {
  return <span {...props} className={clsx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", BADGE[color], className)} />;
}

export function statusColor(status: string): keyof typeof BADGE {
  if (["PAID", "COMPLETED", "SIGNED", "ACTIVE", "READY", "ACCEPTED", "APPROVED", "MET", "pass"].includes(status)) return "green";
  if (["SENT", "SUBMITTED", "SCHEDULED", "PROGRESSING", "IN_PROGRESS"].includes(status)) return "blue";
  if (["DRAFT", "PENDING", "PARTIAL", "PROSPECT", "REQUESTED", "EARLY", "TRANSCRIBING", "GENERATING", "RECORDING", "warn", "LATE_CANCEL"].includes(status)) return "amber";
  if (["VOID", "DENIED", "REJECTED", "ERROR", "NO_SHOW", "CANCELLED", "fail", "REVOKED"].includes(status)) return "red";
  return "gray";
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-8 ring-brand-50/50">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const AVATAR_COLORS = ["bg-teal-100 text-teal-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-violet-100 text-violet-800", "bg-lime-100 text-lime-800"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  const letters = `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  const color = AVATAR_COLORS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const dims = size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  return <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", color, dims, className)}>{letters || "?"}</span>;
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: ReactNode; key: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={clsx(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors",
            t.key === active ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto rounded-xl border border-line bg-white", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={clsx("border-b border-line bg-canvas px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted", className)}>{children}</th>;
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("border-b border-line px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return <div className={clsx("rounded-lg border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}
