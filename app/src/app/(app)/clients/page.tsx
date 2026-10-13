import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Users, Plus, Upload, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { Avatar, Badge, ButtonLink, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, statusColor, cn } from "@/components/ui";
import { CLIENT_STATUS } from "@/lib/constants";
import { date, money } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; tag?: string }> }) {
  const { q, status = "ACTIVE", tag } = await searchParams;
  const where: Prisma.ClientWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (tag) where.tags = { some: { name: tag } };
  if (q) where.OR = [{ firstName: { contains: q } }, { lastName: { contains: q } }, { preferredName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { mrn: { contains: q } }];

  const [total, clients, tags, counts] = await Promise.all([
    db.client.count(),
    db.client.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        tags: true,
        provider: { select: { firstName: true, lastName: true } },
        sessions: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } },
        appointments: { where: { startsAt: { gte: new Date() }, status: "SCHEDULED" }, orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
        invoices: { where: { status: { in: ["SENT", "PARTIAL"] } }, select: { totalCents: true, paidCents: true } },
      },
    }),
    db.tag.findMany({ orderBy: { name: "asc" } }),
    db.client.groupBy({ by: ["status"], _count: true }),
  ]);
  const countFor = (s: string) => (s === "ALL" ? total : counts.find((c) => c.status === s)?._count ?? 0);

  if (total === 0) {
    return (
      <>
        <PageHeader title="Clients" />
        <Card>
          <EmptyState
            icon={<Users className="size-6" />}
            title="Your whole caseload, organized in one place"
            description="Keep client details, session history and documents together in one secure record."
            action={
              <div className="flex gap-2">
                <ButtonLink href="/clients/new">
                  <Plus className="size-4" /> Add your first client
                </ButtonLink>
                <ButtonLink href="/clients/import" variant="outline">
                  <Upload className="size-4" /> Import from CSV
                </ButtonLink>
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, tag, ...patch })) if (v) p.set(k, v);
    return `/clients?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Clients"
        actions={
          <>
            <ButtonLink href="/clients/import" variant="outline">
              <Upload className="size-4" /> Import
            </ButtonLink>
            <ButtonLink href="/clients/new">
              <Plus className="size-4" /> Add client
            </ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
          {(["ACTIVE", "PROSPECT", "INACTIVE", "DISCHARGED", "ALL"] as const).map((s) => (
            <Link key={s} href={href({ status: s })} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", status === s ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink")}>
              {s === "ALL" ? "All" : CLIENT_STATUS[s]} <span className="text-xs text-muted">{countFor(s)}</span>
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={q} placeholder="Search name, email, phone, MRN" className="w-72" />
          <Select name="tag" defaultValue={tag ?? ""} className="w-40">
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
          <button className="h-9 rounded-lg border border-line bg-white px-3 text-sm hover:bg-canvas">Search</button>
        </form>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Contact</Th>
            <Th>Status</Th>
            <Th>Clinician</Th>
            <Th>Last session</Th>
            <Th>Next appointment</Th>
            <Th className="text-right">Balance</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 && (
            <tr>
              <Td colSpan={8} className="py-10 text-center text-muted">
                No clients match.
              </Td>
            </tr>
          )}
          {clients.map((c) => {
            const balance = c.invoices.reduce((n, i) => n + i.totalCents - i.paidCents, 0);
            return (
              <tr key={c.id} className="hover:bg-canvas/60">
                <Td>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                    <Avatar name={`${c.firstName} ${c.lastName}`} size="sm" />
                    <div>
                      <div className="font-medium">
                        {c.preferredName || c.firstName} {c.lastName}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {c.kind !== "INDIVIDUAL" && <span className="text-xs text-muted">{c.kind.toLowerCase()}</span>}
                        {c.tags.map((t) => (
                          <span key={t.id} className="rounded bg-brand-50 px-1.5 text-[11px] text-brand-800">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </Td>
                <Td className="text-muted">
                  <div>{c.email ?? "—"}</div>
                  <div className="text-xs">{c.phone}</div>
                </Td>
                <Td>
                  <Badge color={statusColor(c.status)}>{CLIENT_STATUS[c.status as keyof typeof CLIENT_STATUS]}</Badge>
                </Td>
                <Td className="text-muted">{c.provider ? `${c.provider.firstName} ${c.provider.lastName}` : "—"}</Td>
                <Td className="text-muted">{c.sessions[0] ? date(c.sessions[0].startedAt) : "—"}</Td>
                <Td className="text-muted">{c.appointments[0] ? date(c.appointments[0].startsAt, "MMM d, h:mm a") : "—"}</Td>
                <Td className={cn("text-right tabular-nums", balance > 0 && "font-medium text-amber-700")}>{balance ? money(balance) : "—"}</Td>
                <Td>
                  <Link href={`/clients/${c.id}`} className="text-muted hover:text-ink">
                    <ArrowRight className="size-4" />
                  </Link>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
