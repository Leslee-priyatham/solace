import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readUpload, mimeFromName } from "@/lib/storage";

/** Lets a client download attachments from their own conversation only. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const messageId = new URL(req.url).searchParams.get("m");
  const client = await db.client.findUnique({ where: { portalToken: token } });
  if (!client || !messageId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const m = await db.message.findFirst({ where: { id: messageId, conversation: { clientId: client.id } } });
  if (!m?.attachmentPath) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = await readUpload(m.attachmentPath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeFromName(m.attachmentPath),
      "Content-Disposition": `attachment; filename="${(m.attachmentName ?? "file").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
