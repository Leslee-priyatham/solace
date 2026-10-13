import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/** Display names for the Assistant's context chips. */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({}, { status: 401 });
  const params = new URL(req.url).searchParams;
  const sessionId = params.get("sessionId");
  let clientId = params.get("clientId");
  let session: { id: string; title: string } | null = null;
  if (sessionId) {
    const s = await db.session.findUnique({ where: { id: sessionId } });
    if (s) {
      session = { id: s.id, title: s.title ?? "This session" };
      clientId = clientId ?? s.clientId;
    }
  }
  const c = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;
  return NextResponse.json({
    client: c ? { id: c.id, name: `${c.firstName} ${c.lastName}`, status: c.status, sessions: await db.session.count({ where: { clientId: c.id } }) } : null,
    session,
  });
}
