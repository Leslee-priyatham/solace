import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";
import { date, money } from "@/lib/format";
import { createClaim } from "../../actions";

export const metadata = { title: "New claim" };

/** Entry point from a session page: confirm, then create a draft claim for that session. */
export default async function NewClaimPage({ searchParams }: { searchParams: Promise<{ client?: string; session?: string; error?: string }> }) {
  const { client, session, error } = await searchParams;
  if (!client || !session) redirect("/insurance/unbilled");
  const s = await db.session.findUnique({ where: { id: session }, include: { client: { include: { policies: { where: { archived: false }, include: { payer: true } } } } } });
  if (!s?.client) redirect("/insurance/unbilled");

  async function create() {
    "use server";
    const r = await createClaim({ clientId: client!, sessionIds: [session!] });
    redirect(r.id ? `/insurance/claims/${r.id}` : `/insurance/claims/new?client=${client}&session=${session}&error=${encodeURIComponent(r.error ?? "Couldn't create the claim")}`);
  }

  return (
    <Card className="max-w-xl space-y-4 p-6">
      <h2 className="text-lg font-semibold">Create an insurance claim</h2>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="text-sm">
        <div>
          <span className="text-muted">Client:</span> {s.client.firstName} {s.client.lastName}
        </div>
        <div>
          <span className="text-muted">Session:</span> {date(s.startedAt)} · {s.cpt ?? "no code"} · {money(s.feeCents ?? 0)}
        </div>
        <div>
          <span className="text-muted">Payer:</span> {s.client.policies[0]?.payer.name ?? "No policy on file"}
        </div>
      </div>
      <form action={create}>
        <SubmitButton>Create draft claim</SubmitButton>
      </form>
    </Card>
  );
}
