import { PageHeader } from "@/components/ui";
import { ConvertUpload } from "@/components/convert-upload";
import { convertPdfToForm } from "../actions";

export const metadata = { title: "Convert a PDF" };

export default function ConvertFormPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Practice forms", href: "/forms" }, { label: "Convert a PDF" }]}
        title="Turn a PDF into a digital form"
        description="Upload a text-based PDF of a form you already use. The AI rebuilds it as an interactive form you can edit before sending."
      />
      <ConvertUpload action={convertPdfToForm} redirectBase="/forms" cta="Convert to form" />
    </>
  );
}
