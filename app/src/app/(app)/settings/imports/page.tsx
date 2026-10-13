import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import records" };

export default async function ImportsPage() {
  const jobs = await db.importJob.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Import records" description="Bring your clients over from another EHR or a spreadsheet." />
      <div className="max-w-3xl space-y-6">
        <ImportForm />
        <Card>
          <CardHeader title="Past imports" />
          {jobs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No imports yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {jobs.map((j) => {
                const s = j.summary as { created: number; skipped: number; errors: string[] };
                return (
                  <li key={j.id} className="px-5 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{j.fileName}</span>
                      <span className="text-muted">{dateTime(j.createdAt)}</span>
                    </div>
                    <div className="text-muted">
                      {s.created} created · {s.skipped} duplicates skipped · {s.errors.length} errors
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
