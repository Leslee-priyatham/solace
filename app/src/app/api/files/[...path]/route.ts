import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readUpload, mimeFromName } from "@/lib/storage";

/** Serves stored uploads (recordings, client files, attachments) to signed-in staff. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await currentUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  try {
    const data = await readUpload(rel);
    const download = new URL(req.url).searchParams.get("download");
    const name = rel.split("/").pop()!.replace(/^\d+-[A-Za-z0-9_-]+-/, "");
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeFromName(rel),
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=3600",
        ...(download ? { "Content-Disposition": `attachment; filename="${name}"` } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
