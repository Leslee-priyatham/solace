import { Video, MapPin, Mic } from "lucide-react";
import { db } from "@/lib/db";
import { ButtonLink, Card, EmptyState, Badge } from "@/components/ui";
import { SessionRow, sessionRowInclude } from "@/components/session-row";
import { dateTime, time } from "@/lib/format";

export default async function ClientSessionsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [upcoming, sessions] = await Promise.all([
    db.appointment.findMany({
      where: { clientId: id, startsAt: { gte: new Date(Date.now() - 30 * 60e3), lte: new Date(Date.now() + 30 * 864e5) }, status: { in: ["SCHEDULED", "REQUESTED"] } },
      include: { service: true },
      orderBy: { startsAt: "asc" },
    }),
    db.session.findMany({ where: { clientId: id }, include: sessionRowInclude, orderBy: { startedAt: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <section>
        <Divider label="Upcoming sessions (next 30 days)" />
        {upcoming.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">Nothing scheduled.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.service?.name ?? a.title ?? "Session"}</div>
                  <div className="text-sm text-muted">
                    {dateTime(a.startsAt)} – {time(a.endsAt)}
                  </div>
                </div>
                {a.status === "REQUESTED" && <Badge color="amber">Requested</Badge>}
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
                    <Mic className="size-4" /> Capture
                  </ButtonLink>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
      <section>
        <Divider label="Past sessions" />
        {sessions.length === 0 ? (
          <Card>
            <EmptyState title="No sessions yet" description="Record, upload or write up a session to create the first note." action={<ButtonLink href={`/capture/write?client=${id}`}>Write a note</ButtonLink>} />
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <SessionRow key={s.id} s={s} hideClient />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 text-sm text-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
