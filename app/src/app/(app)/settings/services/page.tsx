import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ServicesTable } from "./services-table";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const services = await db.service.findMany({ orderBy: [{ archived: "asc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title="Services" description="The services your practice offers, used for appointments, invoices, claims and self-scheduling." />
      <ServicesTable services={services.map((s) => ({ id: s.id, name: s.name, cpt: s.cpt ?? "", description: s.description ?? "", durationMin: s.durationMin, rateCents: s.rateCents, selfSchedule: s.selfSchedule, archived: s.archived }))} />
    </>
  );
}
