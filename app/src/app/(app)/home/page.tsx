import Link from "next/link";
import { Smile, Sparkles, ArrowRight, Video, MapPin, KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isConfigured } from "@/lib/ai/client";
import { ButtonLink, Card, EmptyState, Avatar, Stat, Badge } from "@/components/ui";
import { SessionRow, sessionRowInclude } from "@/components/session-row";
import { dateTime, time, money } from "@/lib/format";
import { format } from "date-fns";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 864e5);
  const [recent, upcoming, unsigned, aiText, aiTranscription, openInvoices, activeClients] = await Promise.all([
    db.session.findMany({ orderBy: { startedAt: "desc" }, take: 5, include: sessionRowInclude }),
    db.appointment.findMany({
      where: { startsAt: { gte: new Date(now.getTime() - 30 * 60e3), lte: weekAhead }, status: { in: ["SCHEDULED", "REQUESTED"] }, kind: "SESSION" },
      include: { client: true, service: true },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
    db.noteDocument.count({ where: { status: "DRAFT", sessionId: { not: null } } }),
    isConfigured("text"),
    isConfigured("transcription"),
    db.invoice.aggregate({ _sum: { totalCents: true, paidCents: true }, where: { status: { in: ["SENT", "PARTIAL"] } } }),
    db.client.count({ where: { status: "ACTIVE" } }),
  ]);
  const outstanding = (openInvoices._sum.totalCents ?? 0) - (openInvoices._sum.paidCents ?? 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Smile className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.firstName}</h1>
          <p className="text-muted">{format(now, "EEEE, MMMM d")}</p>
        </div>
      </div>

      {(!aiText || !aiTranscription) && (
        <Card className="flex flex-wrap items-center gap-5 bg-gradient-to-r from-white to-brand-50 p-6">
          <span className="flex size-14 items-center justify-center rounded-xl border border-line bg-white text-brand-700">
            <KeyRound className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Connect your AI provider</h2>
            <p className="text-muted">
              Add an API key from OpenAI, Anthropic, Gemini, Deepgram, or any OpenAI-compatible service to turn sessions into notes.
              {aiText && !aiTranscription && " Writing is set up — add a transcription provider to record sessions."}
            </p>
          </div>
          <ButtonLink href="/settings/ai">
            Set up AI <ArrowRight className="size-4" />
          </ButtonLink>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Upcoming this week" value={upcoming.length} />
        <Stat label="Notes to sign" value={unsigned} hint={unsigned ? <Link href="/sessions?filter=unsigned" className="text-brand-700">Review →</Link> : "All caught up"} />
        <Stat label="Active clients" value={activeClients} />
        <Stat label="Outstanding" value={money(outstanding)} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming sessions</h2>
          <Link href="/calendar" className="text-sm font-medium text-brand-700">
            Open calendar
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState title="Nothing scheduled this week" description="Book a session from the calendar or a client's profile." action={<ButtonLink href="/calendar?new=1" variant="outline">Schedule a session</ButtonLink>} />
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                {a.client && <Avatar name={`${a.client.firstName} ${a.client.lastName}`} />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.client ? `${a.client.firstName} ${a.client.lastName}` : a.title}</div>
                  <div className="text-sm text-muted">
                    {dateTime(a.startsAt)} – {time(a.endsAt)} · {a.service?.name ?? "Session"}
                  </div>
                </div>
                <Badge color={a.modality === "TELEHEALTH" ? "blue" : "gray"}>
                  {a.modality === "TELEHEALTH" ? <Video className="mr-1 size-3" /> : <MapPin className="mr-1 size-3" />}
                  {a.modality === "TELEHEALTH" ? "Telehealth" : "In person"}
                </Badge>
                {a.modality === "TELEHEALTH" ? (
                  <ButtonLink href={`/telehealth/room?appointment=${a.id}`} size="sm">
                    <Video className="size-4" /> Start
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/capture/record?mode=IN_PERSON&appointment=${a.id}`} size="sm" variant="outline">
                    Capture
                  </ButtonLink>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <Link href="/sessions" className="text-sm font-medium text-brand-700">
            Show all
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Sparkles className="size-6" />}
              title="Your first note is a few minutes away"
              description="Record a session, upload a recording, or dictate a summary — the note writes itself."
              action={<ButtonLink href="/capture">Capture a session</ButtonLink>}
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
