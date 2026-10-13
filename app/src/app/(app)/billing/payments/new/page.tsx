import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { NewPayment } from "./new-payment";

export const metadata = { title: "Record payment" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const clients = await db.client.findMany({ orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } });
  return (
    <Card className="max-w-xl p-6">
      <h2 className="mb-4 text-lg font-semibold">Record a payment</h2>
      <NewPayment clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }))} clientId={client} />
    </Card>
  );
}
