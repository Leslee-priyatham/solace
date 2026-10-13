import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Table, Td, Th } from "@/components/ui";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100 }),
    db.auditLog.count(),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Who accessed or changed records, and when. Entries can't be edited." />
      <Table>
        <thead>
          <tr>
            <Th>When</Th>
            <Th>Who</Th>
            <Th>Action</Th>
            <Th>Record</Th>
            <Th>Detail</Th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap text-muted">{dateTime(l.createdAt)}</Td>
              <Td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : "System"}</Td>
              <Td className="font-medium">{l.action}</Td>
              <Td className="text-muted">
                {l.entity}
                {l.entityId && <span className="ml-1 font-mono text-xs">{l.entityId.slice(-8)}</span>}
              </Td>
              <Td className="max-w-xs truncate text-muted">{l.detail}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 flex justify-between text-sm text-muted">
        <span>
          {total} entries · page {page}
        </span>
        <span className="flex gap-3">
          {page > 1 && <a href={`/settings/audit?page=${page - 1}`} className="text-brand-700">Newer</a>}
          {page * 100 < total && <a href={`/settings/audit?page=${page + 1}`} className="text-brand-700">Older</a>}
        </span>
      </div>
    </>
  );
}
