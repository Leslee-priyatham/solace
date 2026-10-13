import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { BookingFlow } from "./booking-flow";

export const metadata = { title: "Book a session" };

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const practice = await db.practice.findUnique({ where: { slug } });
  if (!practice) notFound();
  const settings = ((practice.settings ?? {}) as { portal?: { selfScheduling?: boolean; hidePrices?: boolean } }).portal ?? {};
  const [services, providers, client] = await Promise.all([
    db.service.findMany({ where: { selfSchedule: true, archived: false }, orderBy: { sortOrder: "asc" } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" }, availability: { some: {} } }, select: { id: true, firstName: true, lastName: true } }),
    c ? db.client.findUnique({ where: { portalToken: c } }) : null,
  ]);
  return (
    <PublicShell practice={practice} backHref={c ? `/portal/${c}` : undefined}>
      {!settings.selfScheduling || services.length === 0 || providers.length === 0 ? (
        <div className="py-8 text-center">
          <h1 className="text-xl font-semibold">Online booking isn't open right now</h1>
          <p className="mt-1 text-muted">Please contact {practice.displayName || practice.name} directly{practice.email ? ` at ${practice.email}` : ""}.</p>
        </div>
      ) : (
        <BookingFlow
          slug={slug}
          portalToken={client ? c : undefined}
          knownName={client ? `${client.firstName} ${client.lastName}` : undefined}
          currency={practice.currency}
          hidePrices={!!settings.hidePrices}
          services={services.map((s) => ({ id: s.id, name: s.name, description: s.description, durationMin: s.durationMin, rateCents: s.rateCents }))}
          providers={providers.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` }))}
        />
      )}
    </PublicShell>
  );
}
