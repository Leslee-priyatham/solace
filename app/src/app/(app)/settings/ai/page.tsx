import { db } from "@/lib/db";
import { maskKey, decrypt } from "@/lib/crypto";
import { PageHeader } from "@/components/ui";
import { AiSettings } from "./ai-settings";

export const metadata = { title: "AI providers" };

export default async function AiPage() {
  const [providers, text, transcription] = await Promise.all([
    db.aiProvider.findMany({ orderBy: { createdAt: "asc" } }),
    db.setting.findUnique({ where: { key: "ai.text" } }),
    db.setting.findUnique({ where: { key: "ai.transcription" } }),
  ]);
  const rows = providers.map((p) => {
    let masked = "";
    try {
      masked = p.apiKeyEnc ? maskKey(decrypt(p.apiKeyEnc)) : "";
    } catch {
      masked = "unreadable — re-enter key";
    }
    return { id: p.id, kind: p.kind, label: p.label, baseUrl: p.baseUrl, model: p.model, maskedKey: masked };
  });
  return (
    <>
      <PageHeader
        title="AI providers"
        description="Bring your own API key. Notes, treatment plans, the assistant, compliance checks and transcription all run through the providers you add here."
      />
      <AiSettings
        providers={rows}
        assignments={{
          text: (text?.value ?? null) as { providerId?: string; model?: string } | null,
          transcription: (transcription?.value ?? null) as { providerId?: string; model?: string } | null,
        }}
      />
    </>
  );
}
