import { PageHeader } from "@/components/ui";
import { captureOptions } from "../pickers";
import { Recorder } from "./recorder";

export const metadata = { title: "Record session" };

export default async function RecordPage({ searchParams }: { searchParams: Promise<{ mode?: string; appointment?: string; client?: string }> }) {
  const { mode = "IN_PERSON", appointment, client } = await searchParams;
  const options = await captureOptions(appointment);
  const virtual = mode === "VIRTUAL";
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Session capture", href: "/capture" }, { label: virtual ? "Virtual session" : "In-person session" }]}
        title={virtual ? "Capture a virtual session" : "Record an in-person session"}
        description={
          virtual
            ? "Share the browser tab (or window) running your video call and tick “Share audio”. Your microphone is recorded alongside it."
            : "Keep this tab open and your device close to both of you. You can pause at any time."
        }
      />
      <Recorder mode={virtual ? "VIRTUAL" : "IN_PERSON"} options={options} initialClientId={client} />
    </>
  );
}
