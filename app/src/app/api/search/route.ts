import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { date } from "@/lib/format";

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json([], { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);
  const contains = { contains: q };

  const [clients, sessions, invoices, forms, templates] = await Promise.all([
    db.client.findMany({
      where: { OR: [{ firstName: contains }, { lastName: contains }, { preferredName: contains }, { email: contains }, { mrn: contains }, { phone: contains }] },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    db.session.findMany({
      where: { OR: [{ title: contains }, { synopsis: contains }, { rawText: contains }, { client: { OR: [{ firstName: contains }, { lastName: contains }] } }] },
      include: { client: true },
      take: 6,
      orderBy: { startedAt: "desc" },
    }),
    db.invoice.findMany({ where: { OR: [{ number: contains }, { client: { OR: [{ firstName: contains }, { lastName: contains }] } }] }, include: { client: true }, take: 4 }),
    db.form.findMany({ where: { name: contains, archived: false }, take: 4 }),
    db.noteTemplate.findMany({ where: { name: contains, archived: false }, take: 4 }),
  ]);

  return NextResponse.json([
    ...clients.map((c) => ({ type: "client", id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: [c.email, c.mrn].filter(Boolean).join(" · "), href: `/clients/${c.id}` })),
    ...sessions.map((s) => ({
      type: "session",
      id: s.id,
      title: s.title || "Untitled session",
      subtitle: `${s.client ? `${s.client.firstName} ${s.client.lastName} · ` : ""}${date(s.startedAt)}`,
      href: `/sessions/${s.id}`,
    })),
    ...invoices.map((i) => ({ type: "invoice", id: i.id, title: `Invoice ${i.number}`, subtitle: `${i.client.firstName} ${i.client.lastName}`, href: `/billing/invoices/${i.id}` })),
    ...forms.map((f) => ({ type: "form", id: f.id, title: f.name, subtitle: f.isLibrary ? "Form library" : "Practice form", href: `/forms/${f.id}` })),
    ...templates.map((t) => ({ type: "template", id: t.id, title: t.name, subtitle: "Note template", href: `/templates/${t.id}` })),
  ]);
}
