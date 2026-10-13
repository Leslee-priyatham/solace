import Link from "next/link";
import { User, Monitor, Upload, PenLine, Video, ArrowRight } from "lucide-react";
import { Card, PageHeader, Notice } from "@/components/ui";
import { isConfigured } from "@/lib/ai/client";

export const metadata = { title: "Session capture" };

const OPTIONS = [
  { group: "In-person sessions", items: [{ href: "/capture/record?mode=IN_PERSON", icon: User, title: "Record in the browser", text: "Place your device in the room and record the conversation." }] },
  {
    group: "Virtual sessions held outside the app",
    items: [{ href: "/capture/record?mode=VIRTUAL", icon: Monitor, title: "Capture a call in the browser", text: "Share the tab or window of your Zoom/Meet/Teams call so both voices are recorded." }],
  },
  {
    group: "Telehealth",
    items: [{ href: "/telehealth", icon: Video, title: "Built-in telehealth", text: "Hold a secure video session and have it recorded automatically." }],
  },
  {
    group: "Generate notes from past sessions",
    items: [
      { href: "/capture/upload", icon: Upload, title: "Upload a recording", text: "MP3, M4A, WAV, WebM or OGG from any recorder." },
      { href: "/capture/write", icon: PenLine, title: "Write or dictate", text: "Type or speak a quick summary and get a full note." },
    ],
  },
];

export default async function CapturePage() {
  const [text, transcription] = await Promise.all([isConfigured("text"), isConfigured("transcription")]);
  return (
    <>
      <PageHeader title="Capture any session" description="Flexible ways to get notes from in-person, virtual and past sessions." />
      {(!text || !transcription) && (
        <Notice tone="warn" className="mb-6">
          {!text ? "No writing model is configured. " : ""}
          {!transcription ? "No transcription provider is configured, so recordings can't be transcribed yet. " : ""}
          <Link href="/settings/ai" className="font-medium underline">
            Set up AI providers
          </Link>
        </Notice>
      )}
      <div className="space-y-8">
        {OPTIONS.map((g) => (
          <section key={g.group}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{g.group}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {g.items.map((o) => (
                <Link key={o.href} href={o.href}>
                  <Card className="flex items-center gap-4 p-5 transition hover:border-brand-300 hover:shadow-sm">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <o.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{o.title}</div>
                      <div className="text-sm text-muted">{o.text}</div>
                    </div>
                    <ArrowRight className="size-4 text-muted" />
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
