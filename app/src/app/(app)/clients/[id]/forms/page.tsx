import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Table, Td, Th, statusColor, cn } from "@/components/ui";
import { date } from "@/lib/format";
import { SendFormsButton } from "@/app/(app)/forms/send-forms";
import { RequestActions } from "./request-actions";

export default async function ClientFormsTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ send?: string; show?: string }> }) {
  const { id } = await params;
  const { send, show = "all" } = await searchParams;
  const requests = await db.formRequest.findMany({
    where: { clientId: id, ...(show === "completed" ? { status: "COMPLETED" } : {}) },
    include: { form: true },
    orderBy: { sentAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
          {[
            ["all", "All"],
            ["completed", "Completed"],
          ].map(([k, l]) => (
            <Link key={k} href={`/clients/${id}/forms?show=${k}`} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", show === k ? "bg-brand-50 text-brand-800" : "text-muted")}>
              {l}
            </Link>
          ))}
        </div>
        <SendFormsButton clientId={id} defaultOpen={send === "1"} variant="primary" />
      </div>
      {requests.length === 0 ? (
        <Card>
          <EmptyState title="No form requests" description="Send intake, consent or assessment forms. Your client completes them in their portal." />
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Date sent</Th>
              <Th>Date completed</Th>
              <Th>Score</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/forms/requests/${r.id}`} className="font-medium hover:text-brand-700">
                    {r.form.name}
                  </Link>
                </Td>
                <Td className="text-muted">{date(r.sentAt)}</Td>
                <Td className="text-muted">{r.completedAt ? date(r.completedAt) : "—"}</Td>
                <Td>{r.score ?? "—"}</Td>
                <Td>
                  <Badge color={statusColor(r.status)}>{r.status.replace("_", " ").toLowerCase()}</Badge>
                </Td>
                <Td className="text-right">
                  <RequestActions id={r.id} token={r.token} status={r.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
