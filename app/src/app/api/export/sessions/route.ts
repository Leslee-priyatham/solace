import { endOfMonth, startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const month = new Date(`${url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)}-01T12:00:00`);
  const provider = url.searchParams.get("provider");
  const sessions = await db.session.findMany({
    where: { startedAt: { gte: startOfMonth(month), lte: endOfMonth(month) }, ...(provider ? { providerId: provider } : {}) },
    include: { client: true, provider: true, documents: { select: { status: true } } },
    orderBy: { startedAt: "asc" },
  });
  const csv = toCsv([
    ["Date", "Start", "Minutes", "Client", "MRN", "Clinician", "Type", "CPT", "Fee", "Billing", "Note status"],
    ...sessions.map((s) => [
      s.startedAt.toISOString().slice(0, 10),
      s.startedAt.toISOString().slice(11, 16),
      Math.round(s.durationSec / 60),
      s.client ? `${s.client.firstName} ${s.client.lastName}` : "",
      s.client?.mrn ?? "",
      `${s.provider.firstName} ${s.provider.lastName}`,
      s.captureMode,
      s.cpt ?? "",
      s.feeCents != null ? (s.feeCents / 100).toFixed(2) : "",
      s.billingType,
      s.documents.length && s.documents.every((d) => d.status === "SIGNED") ? "signed" : s.documents.length ? "unsigned" : "none",
    ]),
  ]);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="sessions-${month.toISOString().slice(0, 7)}.csv"` } });
}
