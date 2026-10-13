import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NotePrefsForm } from "./note-prefs-form";

export const metadata = { title: "Note settings" };

export default async function NoteSettingsPage() {
  const u = await requireUser();
  const prefs = (u.preferences ?? {}) as { providerTerm?: string; clientTerm?: string; pronouns?: string; defaultModalities?: string[]; defaultTemplateId?: string; coupleTemplateId?: string; clientNoteTemplateId?: string };
  const templates = await db.noteTemplate.findMany({ where: { archived: false }, select: { id: true, name: true, category: true, audience: true } });
  return (
    <>
      <PageHeader title="Note settings" description="How generated notes refer to you and your clients, and which templates are used by default." />
      <NotePrefsForm
        initial={{ providerTerm: prefs.providerTerm ?? "Therapist", clientTerm: prefs.clientTerm ?? "Client", pronouns: prefs.pronouns ?? "", defaultModalities: prefs.defaultModalities ?? [] }}
        defaults={{ individual: templates.find((t) => t.id === prefs.defaultTemplateId)?.name ?? "Standard progress note", couple: templates.find((t) => t.id === prefs.coupleTemplateId)?.name ?? "Couples progress note", clientNote: templates.find((t) => t.id === prefs.clientNoteTemplateId)?.name ?? "Don't generate" }}
      />
    </>
  );
}
