import { PageHeader } from "@/components/ui";
import { captureOptions } from "../pickers";
import { WriteForm } from "./write-form";

export const metadata = { title: "Write or dictate" };

export default async function WritePage({ searchParams }: { searchParams: Promise<{ appointment?: string; client?: string }> }) {
  const { appointment, client } = await searchParams;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Session capture", href: "/capture" }, { label: "Write or dictate" }]}
        title="Write or dictate a session summary"
        description="Jot down what happened in your own words — bullet points are fine. We'll turn it into a complete note in your template."
      />
      <WriteForm options={await captureOptions(appointment)} initialClientId={client} />
    </>
  );
}
