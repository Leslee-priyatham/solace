"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { extractText } from "@/lib/storage";
import { generateNote, templateFromDocument, type TemplateSection } from "@/lib/ai/clinical";
import { sourceForSession } from "@/lib/sessions";

type R = { error?: string; ok?: boolean; id?: string; sections?: { id: string; title: string; html: string }[] };
const rid = () => Math.random().toString(36).slice(2, 10);

export async function createTemplate(form: FormData) {
  const user = await requireUser();
  const audience = String(form.get("audience") ?? "INDIVIDUAL");
  const category = String(form.get("category") ?? "PROGRESS");
  const t = await db.noteTemplate.create({
    data: {
      name: "Untitled template",
      audience,
      category,
      sections: [
        { id: rid(), title: "Session summary", instructions: "Main topics and how the client presented.", format: "paragraph" },
        { id: rid(), title: "Plan", instructions: "Next steps and homework.", format: "bullets" },
      ],
    },
  });
  await audit(user.id, "create", "NoteTemplate", t.id);
  redirect(`/templates/${t.id}`);
}

export async function copyTemplate(id: string) {
  const user = await requireUser();
  const src = await db.noteTemplate.findUniqueOrThrow({ where: { id } });
  const t = await db.noteTemplate.create({
    data: { name: `${src.name} (my version)`, description: src.description, category: src.category, audience: src.audience, guidance: src.guidance, sections: src.sections ?? [] },
  });
  await audit(user.id, "copy", "NoteTemplate", t.id, src.name);
  redirect(`/templates/${t.id}`);
}

export async function saveTemplate(id: string, data: { name: string; description: string; category: string; audience: string; guidance: string; sections: TemplateSection[] }): Promise<R> {
  await requireUser();
  const t = await db.noteTemplate.findUniqueOrThrow({ where: { id } });
  if (t.isSystem) return { error: "Built-in templates can't be edited. Make a copy to customise it." };
  if (!data.name.trim()) return { error: "Give the template a name." };
  if (!data.sections.length) return { error: "Add at least one section." };
  await db.noteTemplate.update({
    where: { id },
    data: {
      name: data.name.trim(),
      description: data.description || null,
      category: data.category,
      audience: data.audience,
      guidance: data.guidance || null,
      sections: data.sections.map((s) => ({ ...s, title: s.title.trim() || "Section" })),
    },
  });
  revalidatePath("/templates");
  return { ok: true };
}

export async function archiveTemplate(id: string) {
  const user = await requireUser();
  await db.noteTemplate.update({ where: { id }, data: { archived: true } });
  await audit(user.id, "archive", "NoteTemplate", id);
  redirect("/templates");
}

export async function setDefaultTemplate(kind: "defaultTemplateId" | "coupleTemplateId" | "clientNoteTemplateId", templateId: string | null): Promise<R> {
  const user = await requireUser();
  const prefs = { ...((user.preferences ?? {}) as object), [kind]: templateId ?? undefined };
  await db.user.update({ where: { id: user.id }, data: { preferences: prefs } });
  revalidatePath("/templates");
  revalidatePath("/settings/notes");
  return { ok: true };
}

export async function convertPdfToTemplate(form: FormData): Promise<R> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a PDF or text file." };
  try {
    const text = await extractText(Buffer.from(await file.arrayBuffer()), file.type || "application/pdf");
    if (text.trim().length < 20) return { error: "We couldn't read any text in that file. Try a text-based PDF." };
    const r = await templateFromDocument(text);
    const t = await db.noteTemplate.create({
      data: {
        name: r.name || file.name.replace(/\.[^.]+$/, ""),
        description: r.description,
        category: ["PROGRESS", "INTAKE", "TREATMENT_PLAN", "DISCHARGE", "OTHER"].includes(r.category) ? r.category : "PROGRESS",
        sections: (r.sections ?? []).map((s) => ({ id: rid(), title: s.title, instructions: s.instructions, format: ["paragraph", "bullets", "short"].includes(s.format) ? s.format : "paragraph" })),
      },
    });
    await audit(user.id, "convert", "NoteTemplate", t.id, file.name);
    return { ok: true, id: t.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Conversion failed" };
  }
}

/** Generates a throwaway preview of the template against an existing session. */
export async function previewTemplate(data: { name: string; guidance: string; sections: TemplateSection[] }, sessionId: string): Promise<R> {
  await requireUser();
  try {
    const { ctx, source } = await sourceForSession(sessionId);
    const sections = await generateNote({ name: data.name, guidance: data.guidance, sections: data.sections }, source, ctx);
    return { ok: true, sections };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Preview failed" };
  }
}
