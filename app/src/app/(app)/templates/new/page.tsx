import { Card, Field, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client-ui";
import { NOTE_CATEGORY } from "@/lib/constants";
import { createTemplate } from "../actions";

export const metadata = { title: "New template" };

export default function NewTemplatePage() {
  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Note templates", href: "/templates" }, { label: "New template" }]} title="New template" description="These settings decide where the template is offered." />
      <Card className="max-w-lg p-6">
        <form action={createTemplate} className="space-y-4">
          <Field label="Who is it for?">
            <Select name="audience" defaultValue="INDIVIDUAL">
              <option value="INDIVIDUAL">Individuals</option>
              <option value="COUPLE">Couples</option>
              <option value="FAMILY">Families</option>
              <option value="ANY">Any session</option>
            </Select>
          </Field>
          <Field label="Document type">
            <Select name="category" defaultValue="PROGRESS">
              {Object.entries(NOTE_CATEGORY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton>Create template</SubmitButton>
        </form>
      </Card>
    </>
  );
}
