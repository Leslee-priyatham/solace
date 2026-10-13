import Link from "next/link";
import { ClipboardList, FileUp, Library, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, ButtonLink, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { date } from "@/lib/format";
import { FormsTabs } from "./forms-tabs";
import { createBlankForm } from "./actions";
import { SendFormsButton } from "./send-forms";

export const metadata = { title: "Practice forms" };

export default async function FormsPage() {
  const forms = await db.form.findMany({
    where: { isLibrary: false, archived: false },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { requests: true } } },
  });
  return (
    <>
      <PageHeader
        title="Practice forms"
        description="Digital intake, consent and assessment forms clients complete securely in their portal."
        actions={
          <>
            <SendFormsButton />
            <ButtonLink href="/forms/convert" variant="outline">
              <FileUp className="size-4" /> Convert a PDF
            </ButtonLink>
            <form action={createBlankForm}>
              <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                <Plus className="size-4" /> New form
              </button>
            </form>
          </>
        }
      />
      <FormsTabs />
      {forms.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <ClipboardList className="mb-3 size-8 text-brand-600" />
            <h3 className="font-semibold">Paperless client onboarding</h3>
            <p className="mt-1 text-sm text-muted">Create digital forms for intake, consent and assessments that clients complete on any device.</p>
            <form action={createBlankForm} className="mt-4">
              <button className="text-sm font-medium text-brand-700">Create your first form →</button>
            </form>
          </Card>
          <Card className="p-6">
            <FileUp className="mb-3 size-8 text-brand-600" />
            <h3 className="font-semibold">Turn your PDFs into digital forms</h3>
            <p className="mt-1 text-sm text-muted">Upload a form you already use and we'll rebuild it as an interactive form.</p>
            <Link href="/forms/convert" className="mt-4 inline-block text-sm font-medium text-brand-700">
              Convert a PDF →
            </Link>
          </Card>
          <Card className="p-6">
            <Library className="mb-3 size-8 text-brand-600" />
            <h3 className="font-semibold">Start from the library</h3>
            <p className="mt-1 text-sm text-muted">Intake questionnaire, informed consent, release of information, PHQ-9, GAD-7 and more.</p>
            <Link href="/forms/library" className="mt-4 inline-block text-sm font-medium text-brand-700">
              Explore templates →
            </Link>
          </Card>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Questions</Th>
              <Th>Sent</Th>
              <Th>Last edited</Th>
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => (
              <tr key={f.id} className="hover:bg-canvas/60">
                <Td>
                  <Link href={`/forms/${f.id}`} className="font-medium hover:text-brand-700">
                    {f.name}
                  </Link>
                  {f.measure && (
                    <Badge color="violet" className="ml-2">
                      Scored
                    </Badge>
                  )}
                </Td>
                <Td className="text-muted">{f.kind.charAt(0) + f.kind.slice(1).toLowerCase()}</Td>
                <Td className="text-muted">{((f.fields ?? []) as { type: string }[]).filter((x) => !["heading", "paragraph"].includes(x.type)).length}</Td>
                <Td className="text-muted">{f._count.requests}</Td>
                <Td className="text-muted">{date(f.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
