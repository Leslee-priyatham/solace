import { Video, CalendarPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink, Card, CardHeader, EmptyState, Avatar } from "@/components/ui";
import { CopyButton } from "@/components/client-ui";
import { dateTime } from "@/lib/format";
import { headers } from "next/headers";

export const metadata = { title: "Telehealth" };

export default async function TelehealthPage() {
  const user = await requireUser();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const link = `${origin}/join/${user.telehealthSlug}`;
  const upcoming = await db.appointment.findMany({
    where: { providerId: user.id, modality: "TELEHEALTH", kind: "SESSION", status: "SCHEDULED", startsAt: { gte: new Date(Date.now() - 3600e3) } },
    include: { client: true },
    orderBy: { startsAt: "asc" },
    take: 10,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Telehealth</h1>
          <p className="mt-1 text-muted">Secure, browser-based video sessions. Nothing for clients to install.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/calendar?new=1" variant="outline">
            <CalendarPlus className="size-4" /> Schedule
          </ButtonLink>
          <ButtonLink href="/telehealth/room">
            <Video className="size-4" /> Start session
          </ButtonLink>
        </div>
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Your personal room link</div>
          <div className="truncate text-sm text-muted">{link}</div>
        </div>
        <CopyButton text={link} label="Copy link" />
      </Card>
      <Card>
        <CardHeader title="Upcoming video sessions" />
        {upcoming.length === 0 ? (
          <EmptyState title="No video sessions planned" description="When you schedule a telehealth session, it appears here for quick access." />
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-3">
                {a.client && <Avatar name={`${a.client.firstName} ${a.client.lastName}`} size="sm" />}
                <div className="flex-1">
                  <div className="font-medium">{a.client ? `${a.client.firstName} ${a.client.lastName}` : a.title}</div>
                  <div className="text-sm text-muted">{dateTime(a.startsAt)}</div>
                </div>
                <ButtonLink href={`/telehealth/room?appointment=${a.id}`} size="sm">
                  <Video className="size-4" /> Start
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
