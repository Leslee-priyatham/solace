import { db } from "@/lib/db";
import { ChartNotes } from "./chart-notes";

export default async function ChartNotesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = await db.chartNote.findMany({ where: { clientId: id }, orderBy: { date: "desc" } });
  const authors = await db.user.findMany({ where: { id: { in: notes.map((n) => n.authorId).filter(Boolean) as string[] } }, select: { id: true, firstName: true, lastName: true } });
  return (
    <ChartNotes
      clientId={id}
      notes={notes.map((n) => {
        const a = authors.find((x) => x.id === n.authorId);
        return { id: n.id, title: n.title, html: n.html, date: n.date.toISOString(), author: a ? `${a.firstName} ${a.lastName}` : null, updatedAt: n.updatedAt.toISOString() };
      })}
    />
  );
}
