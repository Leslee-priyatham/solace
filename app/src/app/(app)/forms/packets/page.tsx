import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { FormsTabs } from "../forms-tabs";
import { PacketsView } from "./packets-view";

export const metadata = { title: "Form packets" };

export default async function PacketsPage() {
  const [packets, forms] = await Promise.all([
    db.formPacket.findMany({ orderBy: { createdAt: "desc" } }),
    db.form.findMany({ where: { isLibrary: false, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Practice forms" description="Bundle your most-used forms into packets and send your whole intake in one click." />
      <FormsTabs />
      <PacketsView packets={packets.map((p) => ({ id: p.id, name: p.name, description: p.description, formIds: p.formIds as string[] }))} forms={forms} />
    </>
  );
}
