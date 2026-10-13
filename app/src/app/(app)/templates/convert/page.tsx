import { PageHeader } from "@/components/ui";
import { ConvertUpload } from "@/components/convert-upload";
import { convertPdfToTemplate } from "../actions";

export const metadata = { title: "Convert a note to a template" };

export default function ConvertTemplatePage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Note templates", href: "/templates" }, { label: "Convert a PDF" }]}
        title="Turn an example note into a template"
        description="Upload a note in the format you like (remove client identifiers first). We'll extract its sections and write instructions for each."
      />
      <ConvertUpload action={convertPdfToTemplate} redirectBase="/templates" cta="Create template" />
    </>
  );
}
