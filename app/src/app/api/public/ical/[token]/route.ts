import { db } from "@/lib/db";

// Private iCal feed of a clinician's appointments (times and type only — no client names).
function fmt(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const users = await db.user.findMany({ where: { status: "ACTIVE" } });
  const user = users.find((u) => (u.preferences as { icalToken?: string } | null)?.icalToken === token);
  if (!user) return new Response("Not found", { status: 404 });
  const appts = await db.appointment.findMany({
    where: { providerId: user.id, status: { in: ["SCHEDULED", "REQUESTED"] }, startsAt: { gte: new Date(Date.now() - 30 * 864e5) } },
    orderBy: { startsAt: "asc" },
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Solace//Practice calendar//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Solace sessions",
    ...appts.flatMap((a) => [
      "BEGIN:VEVENT",
      `UID:${a.id}@solace`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(a.startsAt)}`,
      `DTEND:${fmt(a.endsAt)}`,
      `SUMMARY:${a.kind === "TIME_OFF" ? "Time off" : a.kind === "SESSION" ? (a.modality === "TELEHEALTH" ? "Session (video)" : "Session") : (a.title ?? "Busy").replace(/[,;\\]/g, " ")}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
}
