"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const GROUPS: { title: string; admin?: boolean; items: [string, string][] }[] = [
  {
    title: "Account",
    items: [
      ["/settings/profile", "My profile"],
      ["/settings/clinical", "Clinical info"],
      ["/settings/notes", "Note settings"],
      ["/settings/ai", "AI providers"],
      ["/settings/assistant", "Assistant"],
      ["/settings/compliance", "Compliance checker"],
    ],
  },
  {
    title: "Communication",
    items: [
      ["/settings/portal", "Client portal"],
      ["/settings/messaging", "Messaging"],
      ["/settings/reminders", "Client reminders"],
    ],
  },
  {
    title: "Scheduling",
    items: [
      ["/settings/calendars", "Calendars"],
      ["/settings/availability", "Availability"],
      ["/settings/services", "Services"],
    ],
  },
  {
    title: "Billing",
    items: [
      ["/settings/billing", "Billing settings"],
      ["/settings/billing-profiles", "Billing profiles"],
      ["/settings/payers", "Payers & enrollments"],
    ],
  },
  {
    title: "Practice management",
    admin: true,
    items: [
      ["/settings/practice", "Practice settings"],
      ["/settings/team", "Team members"],
      ["/settings/sessions-overview", "Sessions overview"],
      ["/settings/imports", "Import records"],
      ["/settings/audit", "Audit log"],
    ],
  },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="w-full shrink-0 lg:sticky lg:top-6 lg:w-56 lg:self-start">
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
      <div className="space-y-5">
        {GROUPS.filter((g) => !g.admin || isAdmin).map((g) => (
          <div key={g.title}>
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</div>
            {g.items.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm",
                  pathname === href || pathname.startsWith(`${href}/`) ? "bg-brand-50 font-medium text-brand-800" : "text-ink hover:bg-black/5",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
