import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Sparkles, Mic, Upload, PenLine } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Select, cn } from "@/components/ui";
import { SessionRow, sessionRowInclude } from "@/components/session-row";

export const metadata = { title: "Sessions" };

const FILTERS = [
  ["all", "All"],
  ["unsigned", "To sign"],
  ["signed", "Signed"],
  ["attention", "Needs attention"],
  ["demo", "Demo"],
] as const;
const PAGE = 25;

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; client?: string; page?: string }> }) {
  const { filter = "all", q, client, page = "1" } = await searchParams;
  const where: Prisma.SessionWhereInput = {};
  if (filter === "unsigned") where.documents = { some: { status: "DRAFT" } };
  if (filter === "signed") where.AND = [{ documents: { some: {} } }, { documents: { every: { status: "SIGNED" } } }];
  if (filter === "attention") where.status = { in: ["ERROR", "TRANSCRIBING", "GENERATING"] };
  if (filter === "demo") where.isDemo = true;
  if (client) where.clientId = client;
  if (q) where.OR = [{ title: { contains: q } }, { synopsis: { contains: q } }, { client: { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }] } }];

  const pageNum = Math.max(1, Number(page) || 1);
  const [sessions, total, clients] = await Promise.all([
    db.session.findMany({ where, include: sessionRowInclude, orderBy: { startedAt: "desc" }, skip: (pageNum - 1) * PAGE, take: PAGE }),
    db.session.count({ where }),
    db.client.findMany({ orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const anySessions = total > 0 || filter !== "all" || q || client;
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { filter, q, client, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "filter" && v === "all")) p.set(k, v);
    return `/sessions${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Sessions"
        actions={
          <>
            <ButtonLink href="/capture/write" variant="outline">
              <PenLine className="size-4" /> Write note
            </ButtonLink>
            <ButtonLink href="/capture/upload" variant="outline">
              <Upload className="size-4" /> Upload
            </ButtonLink>
            <ButtonLink href="/capture/record?mode=IN_PERSON">
              <Mic className="size-4" /> Record
            </ButtonLink>
          </>
        }
      />
      {!anySessions ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Automated documentation, tailored to your style"
            description="Capture a session securely and the note writes itself in the template you choose."
            action={<ButtonLink href="/capture">Create your first note</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          <form className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
              {FILTERS.map(([key, label]) => (
                <Link key={key} href={qs({ filter: key, page: undefined })} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === key ? "bg-brand-50 text-brand-800" : "text-muted hover:text-ink")}>
                  {label}
                </Link>
              ))}
            </div>
            <input type="hidden" name="filter" value={filter} />
            <Input name="q" defaultValue={q} placeholder="Search sessions" className="max-w-xs" />
            <Select name="client" defaultValue={client ?? ""} className="max-w-56">
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
            <button className="h-9 rounded-lg border border-line bg-white px-3 text-sm hover:bg-canvas">Apply</button>
          </form>
          {sessions.length === 0 ? (
            <Card className="p-10 text-center text-muted">No sessions match these filters.</Card>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </div>
          )}
          {total > PAGE && (
            <div className="mt-6 flex items-center justify-between text-sm text-muted">
              <span>
                {(pageNum - 1) * PAGE + 1}–{Math.min(pageNum * PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <ButtonLink href={qs({ page: String(pageNum - 1) })} variant="outline" size="sm">
                    Previous
                  </ButtonLink>
                )}
                {pageNum * PAGE < total && (
                  <ButtonLink href={qs({ page: String(pageNum + 1) })} variant="outline" size="sm">
                    Next
                  </ButtonLink>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
