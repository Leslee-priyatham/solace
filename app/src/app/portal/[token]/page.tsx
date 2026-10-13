import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ClipboardList, Receipt, FileText, Video, MapPin, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { Badge, statusColor } from "@/components/ui";
import { date, dateTime, money, time } from "@/lib/format";
import { PortalMessages } from "./portal-messages";
import { CancelButton } from "./cancel-button";

export const metadata = { title: "Client portal", robots: { index: false } };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await db.client.findUnique({
    where: { portalToken: token },
    include: {
      provider: true,
      appointments: { where: { startsAt: { gte: new Date(Date.now() - 2 * 3600e3) }, status: { in: ["SCHEDULED", "REQUESTED"] } }, orderBy: { startsAt: "asc" }, include: { service: true, provider: true } },
      formRequests: { where: { status: { in: ["SENT", "IN_PROGRESS", "COMPLETED"] } }, include: { form: true }, orderBy: { sentAt: "desc" } },
      invoices: { where: { status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" } },
      superbills: { where: { sentAt: { not: null } }, orderBy: { createdAt: "desc" } },
      conversations: { where: { archived: false }, include: { messages: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!c || c.status === "DISCHARGED") notFound();
  const practice = await db.practice.findFirst();
  const portalSettings = ((practice?.settings ?? {}) as { portal?: { selfScheduling?: boolean; messaging?: boolean } }).portal ?? {};
  const pendingForms = c.formRequests.filter((f) => f.status !== "COMPLETED");
  const balance = c.invoices.filter((i) => ["SENT", "PARTIAL"].includes(i.status)).reduce((n, i) => n + i.totalCents - i.paidCents, 0);
  const messages = c.conversations.flatMap((v) => v.messages);

  return (
    <PublicShell practice={practice} wide>
      <h1 className="text-2xl font-semibold">Hi {c.preferredName || c.firstName}</h1>
      <p className="mt-1 text-muted">Your private space with {practice?.displayName || practice?.name}.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Summary icon={<CalendarDays className="size-5" />} label="Next session" value={c.appointments[0] ? dateTime(c.appointments[0].startsAt) : "Nothing booked"} />
        <Summary icon={<ClipboardList className="size-5" />} label="Forms to complete" value={pendingForms.length ? `${pendingForms.length} waiting` : "All done"} />
        <Summary icon={<Receipt className="size-5" />} label="Balance" value={money(balance, practice?.currency)} />
      </div>

      <Section title="Upcoming sessions" action={portalSettings.selfScheduling && practice ? <Link href={`/book/${practice.slug}?c=${token}`} className="text-sm font-medium text-brand-700">Book a session →</Link> : null}>
        {c.appointments.length === 0 ? (
          <p className="text-sm text-muted">No upcoming sessions.</p>
        ) : (
          <ul className="space-y-2">
            {c.appointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {date(a.startsAt, "EEEE, MMMM d")} · {time(a.startsAt)} – {time(a.endsAt)}
                  </div>
                  <div className="text-sm text-muted">
                    {a.service?.name ?? "Session"} with {a.provider.firstName} {a.provider.lastName}
                  </div>
                </div>
                {a.status === "REQUESTED" && <Badge color="amber">Awaiting confirmation</Badge>}
                {a.modality === "TELEHEALTH" ? (
                  <Link href={`/join/${a.provider.telehealthSlug}?a=${a.id}&c=${token}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">
                    <Video className="size-4" /> Join video
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-4" /> In person
                  </span>
                )}
                <CancelButton token={token} appointmentId={a.id} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Forms">
        {c.formRequests.length === 0 ? (
          <p className="text-sm text-muted">No forms right now.</p>
        ) : (
          <ul className="space-y-2">
            {c.formRequests.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <ClipboardList className="size-5 text-brand-600" />
                <span className="flex-1 font-medium">{f.form.name}</span>
                {f.status === "COMPLETED" ? (
                  <span className="flex items-center gap-1 text-sm text-emerald-700">
                    <CheckCircle2 className="size-4" /> Completed {date(f.completedAt)}
                  </span>
                ) : (
                  <Link href={`/f/${f.token}`} className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">
                    {f.status === "IN_PROGRESS" ? "Continue" : "Start"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {portalSettings.messaging !== false && (
        <Section title="Messages">
          <PortalMessages
            token={token}
            clinician={c.provider ? `${c.provider.firstName} ${c.provider.lastName}` : practice?.name ?? "Your clinician"}
            messages={messages.map((m) => ({ id: m.id, sender: m.sender, authorName: m.authorName, body: m.body, attachmentName: m.attachmentName, createdAt: m.createdAt.toISOString() }))}
          />
        </Section>
      )}

      <Section title="Billing">
        {c.invoices.length === 0 && c.superbills.length === 0 ? (
          <p className="text-sm text-muted">No invoices yet.</p>
        ) : (
          <ul className="space-y-2">
            {c.invoices.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                <Receipt className="size-5 text-muted" />
                <Link href={`/portal/${token}/invoice/${i.id}`} className="flex-1 font-medium hover:text-brand-700">
                  Invoice {i.number} · {date(i.issueDate)}
                </Link>
                <span className="tabular-nums">{money(i.totalCents - i.paidCents, practice?.currency)} due</span>
                <Badge color={statusColor(i.status)}>{i.status.toLowerCase()}</Badge>
              </li>
            ))}
            {c.superbills.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm">
                <FileText className="size-5 text-muted" />
                <Link href={`/portal/${token}/superbill/${s.id}`} className="flex-1 font-medium hover:text-brand-700">
                  Superbill {s.number} · {date(s.periodStart)} – {date(s.periodEnd)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {c.portalSummary && (
        <Section title="Your treatment summary">
          <div className="whitespace-pre-line rounded-xl bg-canvas p-5 text-sm leading-relaxed">{c.portalSummary}</div>
        </Section>
      )}
    </PublicShell>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="text-brand-600">{icon}</span> {label}
      </div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
