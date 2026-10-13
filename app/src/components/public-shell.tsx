import Link from "next/link";
import type { Practice } from "@prisma/client";
import { Lock } from "lucide-react";

/** Branded wrapper for client-facing pages (portal, forms, booking, telehealth join). */
export function PublicShell({ practice, children, backHref, wide }: { practice: Practice | null; children: React.ReactNode; backHref?: string; wide?: boolean }) {
  const name = practice?.displayName || practice?.name || "Your practice";
  const color = practice?.brandColor || "#0a8c76";
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className={`mx-auto flex h-16 items-center justify-between px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <Link href={backHref ?? "#"} className="flex items-center gap-3">
            {practice?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={practice.logoUrl} alt="" className="h-8 w-auto" />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ background: color }}>
                {name[0]}
              </span>
            )}
            <span className="font-semibold">{name}</span>
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5" /> Private & secure
          </span>
        </div>
      </header>
      <main className={`mx-auto px-6 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="rounded-2xl border border-line bg-white p-8">{children}</div>
      </main>
    </div>
  );
}
