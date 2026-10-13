import "server-only";
import { db } from "./db";
import { readUpload, mimeFromName } from "./storage";
import { transcribe } from "./ai/transcribe";
import { digestSession, generateNote, labelSpeakers, transcriptToText, type LabeledUtterance, type NoteContext, type TemplateSection } from "./ai/clinical";
import { date } from "./format";

type Prefs = {
  providerTerm?: string;
  clientTerm?: string;
  pronouns?: string;
  defaultTemplateId?: string;
  coupleTemplateId?: string;
  clientNoteTemplateId?: string;
};

export async function noteContext(sessionId: string): Promise<NoteContext> {
  const s = await db.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { provider: true, client: { include: { diagnoses: true, summary: true, contacts: { where: { isParticipant: true } } } } },
  });
  const prefs = (s.provider.preferences ?? {}) as Prefs;
  const c = s.client;
  const clientTerm = prefs.clientTerm === "FIRST_NAME" && c ? c.preferredName || c.firstName : prefs.clientTerm || "Client";
  const summary = c?.summary?.content as { presentingConcerns?: string; progress?: string } | undefined;
  return {
    clientName: c ? `${c.firstName} ${c.lastName}` : undefined,
    clientTerm,
    providerTerm: prefs.providerTerm || "Therapist",
    providerPronouns: prefs.pronouns,
    modalities: (c?.modalities as string[] | undefined) ?? [],
    diagnoses: c?.diagnoses.map((d) => `${d.code} ${d.description}`),
    sessionDate: date(s.startedAt),
    durationMin: s.durationSec ? Math.round(s.durationSec / 60) : undefined,
    sessionKind: c ? `${c.kind.toLowerCase()} session${c.contacts.length ? ` with ${c.contacts.map((x) => x.name).join(", ")}` : ""}` : undefined,
    priorSummary: summary ? [summary.presentingConcerns, summary.progress].filter(Boolean).join("\n") : undefined,
  };
}

/** Which templates a new session's notes are written with. */
export async function templatesForSession(sessionId: string, explicitTemplateId?: string) {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { provider: true, client: true } });
  const prefs = (s.provider.preferences ?? {}) as Prefs;
  const clientPrefs = (s.client?.notePrefs ?? {}) as { templateId?: string; clientNoteTemplateId?: string | null };
  const isCouple = s.client?.kind === "COUPLE" || s.client?.kind === "FAMILY";
  const ids = [
    explicitTemplateId || clientPrefs.templateId || (isCouple ? prefs.coupleTemplateId : prefs.defaultTemplateId),
    clientPrefs.clientNoteTemplateId === undefined ? prefs.clientNoteTemplateId : clientPrefs.clientNoteTemplateId,
  ].filter(Boolean) as string[];
  let templates = ids.length ? await db.noteTemplate.findMany({ where: { id: { in: ids } } }) : [];
  if (!templates.some((t) => t.category !== "CLIENT_NOTE")) {
    const fallback = await db.noteTemplate.findFirst({ where: { isSystem: true, name: isCouple ? "Couples progress note" : "Standard progress note" } });
    if (fallback) templates = [fallback, ...templates];
  }
  return templates;
}

function analytics(t: LabeledUtterance[], total: number) {
  let providerSec = 0;
  let clientSec = 0;
  for (const u of t) {
    const d = Math.max(0, u.end - u.start);
    if (u.speaker === "PROVIDER") providerSec += d;
    else clientSec += d;
  }
  const silenceSec = Math.max(0, (total || t[t.length - 1]?.end || 0) - providerSec - clientSec);
  return { providerSec: Math.round(providerSec), clientSec: Math.round(clientSec), silenceSec: Math.round(silenceSec) };
}

async function fail(sessionId: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`[session ${sessionId}]`, message);
  await db.session.update({ where: { id: sessionId }, data: { status: "ERROR", error: message.slice(0, 1000) } });
}

/** Keeps model-suggested chapters inside the recording, in order, one per start time. */
export function cleanChapters(chapters: { title: string; start: number }[] | undefined, transcript: LabeledUtterance[]) {
  const end = transcript[transcript.length - 1]?.end ?? 0;
  const seen = new Set<number>();
  return (chapters ?? [])
    .filter((c) => c?.title && Number.isFinite(Number(c.start)))
    .map((c) => ({ title: c.title, start: Math.min(Math.max(0, Number(c.start)), end) }))
    .sort((a, b) => a.start - b.start)
    .filter((c) => !seen.has(c.start) && seen.add(c.start));
}

/** Full pipeline. Runs in the background; progress is visible through session.status. */
export async function processSession(sessionId: string, opts: { templateId?: string } = {}) {
  try {
    const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { client: { include: { contacts: true } } } });
    let transcript = s.transcript as unknown as LabeledUtterance[];

    if (s.audioPath && transcript.length === 0) {
      await db.session.update({ where: { id: sessionId }, data: { status: "TRANSCRIBING", error: null } });
      const audio = await readUpload(s.audioPath);
      const raw = await transcribe(audio, mimeFromName(s.audioPath), s.audioPath.split("/").pop() ?? "audio.webm");
      // Transcription models can emit a stray token for silence (gemini-3.5-transcribe hears "5");
      // nothing under a few words can become a note.
      const words = raw.utterances.reduce((n, u) => n + u.text.split(/\s+/).filter(Boolean).length, 0);
      if (words < 3) throw new Error("No speech was detected in the recording.");
      transcript = await labelSpeakers(raw.utterances, raw.diarized, {
        clientName: s.client ? `${s.client.firstName} ${s.client.lastName}` : undefined,
        participants: s.client?.contacts.filter((c) => c.isParticipant).map((c) => c.name),
      });
      const end = transcript[transcript.length - 1]?.end ?? 0;
      await db.session.update({
        where: { id: sessionId },
        data: { transcript: transcript as object[], durationSec: s.durationSec || Math.round(end), analytics: analytics(transcript, s.durationSec || end) },
      });
    }

    await db.session.update({ where: { id: sessionId }, data: { status: "GENERATING", error: null } });
    const ctx = await noteContext(sessionId);
    const transcriptText = transcript.length ? transcriptToText(transcript, ctx) : undefined;
    const source = transcriptText ? { transcript: transcriptText } : { text: s.rawText ?? "" };
    if (!source.transcript && !source.text?.trim()) throw new Error("There is no recording or text to write a note from.");

    const digest = await digestSession(source.transcript ?? source.text!, ctx);
    await db.session.update({
      where: { id: sessionId },
      data: { title: s.title || digest.title, synopsis: digest.synopsis, chapters: transcript.length ? cleanChapters(digest.chapters, transcript) : [] },
    });

    const templates = await templatesForSession(sessionId, opts.templateId);
    // A resumed session may already have some finished notes; don't write them twice.
    const finished = await db.noteDocument.findMany({ where: { sessionId, status: { in: ["DRAFT", "SIGNED"] } }, select: { templateId: true } });
    for (const t of templates) {
      if (finished.some((d) => d.templateId === t.id)) continue;
      const doc = await db.noteDocument.create({
        data: { sessionId, clientId: s.clientId, templateId: t.id, title: t.name, status: "GENERATING" },
      });
      try {
        const sections = await generateNote({ name: t.name, guidance: t.guidance, sections: t.sections as unknown as TemplateSection[] }, source, ctx);
        await db.noteDocument.update({ where: { id: doc.id }, data: { sections, status: "DRAFT" } });
      } catch (e) {
        await db.noteDocument.update({ where: { id: doc.id }, data: { status: "ERROR" } });
        throw e;
      }
    }
    await db.session.update({ where: { id: sessionId }, data: { status: "READY" } });
    await maybeAutoCompliance(sessionId);
  } catch (e) {
    await fail(sessionId, e);
  }
}

/**
 * Processing runs in the server process, so a session still TRANSCRIBING/GENERATING when the server
 * starts was interrupted by a restart. Resume each one (oldest first, one at a time); a saved transcript
 * is reused and finished notes are kept.
 */
export async function resumeInterruptedSessions(bootedAt = new Date()) {
  const stuck = await db.session.findMany({
    where: { status: { in: ["TRANSCRIBING", "GENERATING"] }, updatedAt: { lt: bootedAt } },
    orderBy: { startedAt: "asc" },
    select: { id: true },
  });
  for (const s of stuck) {
    console.log(`[sessions] resuming interrupted session ${s.id}`);
    await db.noteDocument.deleteMany({ where: { sessionId: s.id, status: { in: ["GENERATING", "ERROR"] } } });
    await processSession(s.id);
  }
}

/** Adds one more note (another template) to an existing session. */
export async function addNoteFromTemplate(sessionId: string, templateId: string) {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const t = await db.noteTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const doc = await db.noteDocument.create({ data: { sessionId, clientId: s.clientId, templateId, title: t.name, status: "GENERATING" } });
  try {
    const ctx = await noteContext(sessionId);
    const transcript = s.transcript as unknown as LabeledUtterance[];
    const source = transcript.length ? { transcript: transcriptToText(transcript, ctx) } : { text: s.rawText ?? "" };
    const sections = await generateNote({ name: t.name, guidance: t.guidance, sections: t.sections as unknown as TemplateSection[] }, source, ctx);
    await db.noteDocument.update({ where: { id: doc.id }, data: { sections, status: "DRAFT" } });
  } catch (e) {
    await db.noteDocument.update({ where: { id: doc.id }, data: { status: "ERROR" } });
    throw e;
  }
  return doc.id;
}

async function maybeAutoCompliance(sessionId: string) {
  const p = await db.practice.findFirst();
  const settings = (p?.settings ?? {}) as { compliance?: { autoRun?: boolean; groupId?: string } };
  if (!settings.compliance?.autoRun) return;
  const { runComplianceForNote } = await import("./compliance");
  const docs = await db.noteDocument.findMany({ where: { sessionId, status: "DRAFT" }, include: { template: true } });
  for (const d of docs) {
    if (d.template?.category === "CLIENT_NOTE") continue;
    await runComplianceForNote(d.id, settings.compliance.groupId).catch(() => {});
  }
}

export async function sourceForSession(sessionId: string) {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
  const ctx = await noteContext(sessionId);
  const transcript = s.transcript as unknown as LabeledUtterance[];
  return { ctx, source: transcript.length ? { transcript: transcriptToText(transcript, ctx) } : { text: s.rawText ?? "" } };
}
