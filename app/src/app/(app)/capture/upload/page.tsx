import { PageHeader } from "@/components/ui";
import { captureOptions } from "../pickers";
import { UploadForm } from "./upload-form";

export const metadata = { title: "Upload recording" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ appointment?: string; client?: string }> }) {
  const { appointment, client } = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Session capture", href: "/capture" }, { label: "Upload recording" }]}
        title="Generate a note from a recording"
        description="Upload audio from any recorder or video call. We'll transcribe it, separate the speakers, and write the note."
      />
      <UploadForm options={await captureOptions(appointment)} initialClientId={client} />
    </>
  );
}
