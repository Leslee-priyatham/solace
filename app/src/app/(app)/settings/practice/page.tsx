import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PracticeSettings } from "./practice-settings";

export const metadata = { title: "Practice settings" };

export default async function PracticePage() {
  await requireAdmin();
  const [p, locations] = await Promise.all([db.practice.findFirstOrThrow(), db.location.findMany({ orderBy: { createdAt: "asc" } })]);
  return (
    <>
      <PageHeader title="Practice settings" />
      <PracticeSettings
        practice={{
          name: p.name,
          displayName: p.displayName ?? "",
          email: p.email ?? "",
          phone: p.phone ?? "",
          country: p.country,
          currency: p.currency,
          timezone: p.timezone,
          address: p.address ?? "",
          taxId: p.taxId ?? "",
          brandColor: p.brandColor,
          logoUrl: p.logoUrl ?? "",
          slug: p.slug,
        }}
        locations={locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address ?? "", placeOfService: l.placeOfService }))}
      />
    </>
  );
}
