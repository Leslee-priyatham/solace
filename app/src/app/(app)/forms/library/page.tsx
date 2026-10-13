import Link from "next/link";
import { ClipboardList, ScrollText, Gauge, FileQuestion } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { FormsTabs } from "../forms-tabs";

export const metadata = { title: "Form library" };
const ICON = { INTAKE: ClipboardList, CONSENT: ScrollText, ASSESSMENT: Gauge, OTHER: FileQuestion } as const;

export default async function LibraryPage() {
  const forms = await db.form.findMany({ where: { isLibrary: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Practice forms" description="Clinical templates you can copy into your practice and customise." />
      <FormsTabs />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((f) => {
          const Icon = ICON[f.kind as keyof typeof ICON] ?? FileQuestion;
          const count = ((f.fields ?? []) as { type: string }[]).filter((x) => !["heading", "paragraph"].includes(x.type)).length;
          return (
            <Link key={f.id} href={`/forms/${f.id}`}>
              <Card className="h-full p-5 transition hover:border-brand-300 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{f.name}</div>
                    <p className="mt-1 text-sm text-muted">{f.description}</p>
                    <div className="mt-3 flex gap-2">
                      <Badge>{f.kind.charAt(0) + f.kind.slice(1).toLowerCase()}</Badge>
                      <Badge>{count} questions</Badge>
                      {f.measure && <Badge color="violet">Scored</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
