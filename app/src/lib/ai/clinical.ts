import "server-only";
import { chatJson } from "./client";
import type { Utterance } from "./transcribe";
import { clock, stripHtml, textToHtml } from "@/lib/format";

export interface TemplateSection {
  id: string;
  title: string;
  instructions: string;
  format?: "paragraph" | "bullets" | "short";
}

export interface NoteContext {
  clientName?: string;
  clientTerm: string; // "Client", first name, …
  providerTerm: string; // "Therapist", "Clinician", …
  providerPronouns?: string;
  modalities?: string[];
  diagnoses?: string[];
  sessionDate?: string;
  durationMin?: number;
  sessionKind?: string; // individual / couple / family
  priorSummary?: string;
}

export interface LabeledUtterance {
  start: number;
  end: number;
  speaker: "PROVIDER" | "CLIENT" | "OTHER";
  name?: string;
  text: string;
}

const CLINICAL_GUARDRAILS = `You are a careful clinical documentation assistant for licensed mental-health clinicians.
- Document only what is supported by the source material. Never invent symptoms, scores, risk statements, quotes or interventions.
- If something a section asks for was not discussed, say so briefly (e.g. "Not assessed this session.").
- Use objective, professional, person-first language suitable for a medical record and insurance review.
- Keep identifying details to what the clinician provided.`;

export function transcriptToText(utterances: LabeledUtterance[], ctx?: Pick<NoteContext, "clientTerm" | "providerTerm">) {
  const name = (s: LabeledUtterance) =>
    s.name || (s.speaker === "PROVIDER" ? ctx?.providerTerm ?? "Clinician" : s.speaker === "CLIENT" ? ctx?.clientTerm ?? "Client" : "Other");
  return utterances.map((u) => `[${clock(u.start)}] ${name(u)}: ${u.text}`).join("\n");
}

/**
 * Assigns clinician/client roles to raw transcript turns. Diarized input keeps its turns and only
 * maps labels; undiarized input is re-segmented into turns by the model.
 */
export async function labelSpeakers(
  utterances: Utterance[],
  diarized: boolean,
  hints: { clientName?: string; participants?: string[] },
): Promise<LabeledUtterance[]> {
  if (!utterances.length) return [];
  if (diarized) {
    const labels = [...new Set(utterances.map((u) => u.speaker))];
    const sample = utterances.slice(0, 60).map((u) => `${u.speaker}: ${u.text}`).join("\n");
    const result = await chatJson<{ roles: Record<string, { role: "PROVIDER" | "CLIENT" | "OTHER"; name?: string }> }>({
      system: "You identify speaker roles in therapy session transcripts.",
      messages: [
        {
          role: "user",
          content: `Speaker labels: ${labels.join(", ")}.
Client name (if known): ${hints.clientName ?? "unknown"}. Other participants: ${hints.participants?.join(", ") || "none"}.
Decide which label is the therapist/clinician (PROVIDER), which is the client (CLIENT), and any others (OTHER, with a name if obvious).
Return {"roles": {"<label>": {"role": "PROVIDER|CLIENT|OTHER", "name": "optional"}}}.

Transcript excerpt:
${sample}`,
        },
      ],
      maxTokens: 8000, // thinking models spend part of this budget on reasoning
    });
    return utterances.map((u) => {
      const r = result.roles?.[u.speaker];
      return { start: u.start, end: u.end, speaker: r?.role ?? "OTHER", name: r?.role === "OTHER" ? r.name : undefined, text: u.text };
    });
  }

  // Undiarized: label each segment in batches so long sessions fit comfortably.
  const out: LabeledUtterance[] = [];
  const batch = 120;
  for (let i = 0; i < utterances.length; i += batch) {
    const slice = utterances.slice(i, i + batch);
    const numbered = slice.map((u, j) => `${j}: ${u.text}`).join("\n");
    const result = await chatJson<{ speakers: ("PROVIDER" | "CLIENT" | "OTHER")[] }>({
      system: "You attribute lines of an undiarized therapy session transcript to speakers.",
      messages: [
        {
          role: "user",
          content: `For each numbered line, decide whether the clinician (PROVIDER) or the client (CLIENT) said it (OTHER only for a clear third person). Use conversational cues: questions, reflections and interventions are usually the clinician.
Return {"speakers": ["PROVIDER" | "CLIENT" | "OTHER", ...]} with exactly ${slice.length} entries in order.

${numbered}`,
        },
      ],
      maxTokens: 16000,
    });
    slice.forEach((u, j) => out.push({ start: u.start, end: u.end, speaker: result.speakers?.[j] ?? "CLIENT", text: u.text }));
  }
  // Merge consecutive lines from the same speaker into turns.
  const merged: LabeledUtterance[] = [];
  for (const u of out) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === u.speaker) {
      last.text = `${last.text} ${u.text}`;
      last.end = u.end;
    } else merged.push({ ...u });
  }
  return merged;
}

export interface SessionDigest {
  title: string;
  synopsis: string;
  chapters: { title: string; start: number }[];
}

export async function digestSession(transcriptText: string, ctx: NoteContext): Promise<SessionDigest> {
  return chatJson<SessionDigest>({
    system: CLINICAL_GUARDRAILS,
    messages: [
      {
        role: "user",
        content: `Read this session transcript and return:
- "title": a short clinical headline (max 10 words) capturing the session's main theme, without the client's name.
- "synopsis": 1–2 sentences summarising the session for a session list.
- "chapters": 3–8 topic sections in order, each {"title": "...", "start": <seconds where it begins, from the timestamps>}.

Transcript (${ctx.clientTerm} / ${ctx.providerTerm}):
${transcriptText}`,
      },
    ],
    maxTokens: 8000,
  });
}

function contextBlock(ctx: NoteContext) {
  return [
    `Refer to the clinician as "${ctx.providerTerm}"${ctx.providerPronouns ? ` (pronouns ${ctx.providerPronouns})` : ""} and to the client as "${ctx.clientTerm}".`,
    ctx.sessionKind && `Session type: ${ctx.sessionKind}.`,
    ctx.sessionDate && `Session date: ${ctx.sessionDate}.`,
    ctx.durationMin && `Duration: ${ctx.durationMin} minutes.`,
    ctx.modalities?.length && `Therapeutic modalities in use: ${ctx.modalities.join(", ")}.`,
    ctx.diagnoses?.length && `Current diagnoses: ${ctx.diagnoses.join("; ")}.`,
    ctx.priorSummary && `Background from earlier sessions (for continuity only; do not restate as new findings):\n${ctx.priorSummary}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const FORMAT_HINT: Record<string, string> = {
  paragraph: "Write in concise clinical prose paragraphs.",
  bullets: "Write as a bulleted list (one '- ' item per line).",
  short: "Write one or two short lines.",
};

/** Generates a full note: one HTML body per template section. */
export async function generateNote(
  template: { name: string; guidance?: string | null; sections: TemplateSection[] },
  source: { transcript?: string; text?: string },
  ctx: NoteContext,
): Promise<{ id: string; title: string; html: string }[]> {
  const sectionSpec = template.sections
    .map((s, i) => `${i + 1}. id="${s.id}" — ${s.title}: ${s.instructions} ${FORMAT_HINT[s.format ?? "paragraph"]}`)
    .join("\n");
  const material = source.transcript
    ? `Session transcript:\n${source.transcript}`
    : `Clinician's session notes / dictation:\n${source.text}`;
  const result = await chatJson<{ sections: { id: string; content: string }[] }>({
    system: `${CLINICAL_GUARDRAILS}\n${contextBlock(ctx)}`,
    messages: [
      {
        role: "user",
        content: `Write a "${template.name}" note.${template.guidance ? `\nTemplate guidance: ${template.guidance}` : ""}

Sections:
${sectionSpec}

Return {"sections": [{"id": "<section id>", "content": "<plain text; use blank lines between paragraphs and '- ' for bullet items>"}]} covering every section in order.

${material}`,
      },
    ],
    maxTokens: 16000,
  });
  return template.sections.map((s) => {
    const content = result.sections?.find((x) => x.id === s.id)?.content ?? "Not documented.";
    return { id: s.id, title: s.title, html: textToHtml(content) };
  });
}

// AI edits may reword, shorten, restructure or remove; they may not introduce clinical facts the session
// doesn't support. Clinicians who know something the source doesn't can still type it in themselves.
const EDIT_RULES = `Editing rules:
- Editorial changes (wording, tone, length, structure, order, formatting, person, removing content) are always fine.
- Adding or changing a clinical fact — symptoms, risk or safety statements, substance use, medications or doses, dates and times, diagnoses, scores, quotes, interventions, plans — is only allowed when the source material supports it.
- If the request asks for a fact the source doesn't support or contradicts, do not write it: leave that text as it is and explain in "declined" what the source actually says.`;

type SourceMaterial = { transcript?: string; text?: string };
const sourceText = (source: SourceMaterial) => source.transcript ?? source.text ?? "(none)";
const plain = (html: string) => stripHtml(html).replace(/\s+/g, " ").trim();

/**
 * Independent check of AI-edited sections against the session: returns, per section, the new claims
 * that the source doesn't support or contradicts. Rewording and removals are not problems.
 */
async function unsupportedChanges(
  changes: { id: string; title: string; before: string; after: string }[],
  source: SourceMaterial,
  ctx: NoteContext,
): Promise<{ id: string; claim: string; why: string }[]> {
  if (!changes.length) return [];
  const result = await chatJson<{ problems?: { id: string; claim: string; why: string }[] }>({
    system: "You verify edits to clinical notes against the session record. You are strict about facts and ignore style.",
    messages: [
      {
        role: "user",
        content: `For each EDITED section, list every factual statement that appears in AFTER but not in BEFORE and that the SOURCE does not support or that the SOURCE contradicts (clinical facts: symptoms, risk/safety, substances, medications and doses, dates/times, diagnoses, scores, quotes, interventions, plans).
Ignore rewording, reordering, formatting, shortening, removed content, and statements that mean the same as BEFORE.
Return {"problems": [{"id": "<section id>", "claim": "<the new statement>", "why": "<what the source says, or 'not mentioned in the source'>"}]} — an empty list if there are none.

SOURCE (what the writer was given):
${contextBlock(ctx)}
${sourceText(source)}

EDITED sections:
${changes.map((c) => `### id="${c.id}" — ${c.title}\nBEFORE:\n${c.before}\nAFTER:\n${c.after}`).join("\n\n")}`,
      },
    ],
    maxTokens: 8000,
  });
  const flagged = (result.problems ?? []).filter((p) => p?.claim && changes.some((c) => c.id === p.id));
  // Bulk checks over-flag; re-check each claim on its own and drop it only on a verifiable quote.
  const keep = await Promise.all(flagged.map((p) => confirmUnsupported(p.claim, source, ctx).catch(() => true)));
  return flagged.filter((_, i) => keep[i]);
}

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", fifteen: "15", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", ninety: "90", hundred: "100",
};
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).map((w) => NUMBER_WORDS[w] ?? w);

/** The quote must be made of the source's own words (tolerating "30" vs "thirty" and dropped punctuation). */
function quoteIsFromSource(quote: string, record: string) {
  const q = words(quote);
  if (q.length < 3) return false;
  const vocab = new Set(words(record));
  return q.filter((w) => vocab.has(w)).length / q.length >= 0.9;
}

/**
 * True if `claim` is not supported by the source. "Supported" only counts when the model quotes the
 * source and that quote really appears in it, so a hallucinated justification can't let a claim through.
 */
async function confirmUnsupported(claim: string, source: SourceMaterial, ctx: NoteContext): Promise<boolean> {
  const record = `${contextBlock(ctx)}\n${sourceText(source)}`;
  const r = await chatJson<{ verdict?: string; quote?: string }>({
    system: "You check single statements against a therapy session record. Be precise.",
    messages: [
      {
        role: "user",
        content: `STATEMENT: ${claim}

Does the SOURCE support this statement?
- "supported": the source says the same thing (different words are fine). Copy the exact supporting words.
- "contradicted": the source says otherwise (for example the client denied it).
- "not_mentioned": the source doesn't say it.
A question the clinician asked is not evidence that the client agreed.
Return {"verdict": "supported|contradicted|not_mentioned", "quote": "<exact words copied from the source>"}

SOURCE:
${record}`,
      },
    ],
    maxTokens: 4000,
  });
  if (r.verdict !== "supported") return true;
  return !quoteIsFromSource(r.quote ?? "", record);
}

export async function rewriteSection(
  section: { id?: string; title: string; html: string; instructions?: string },
  instruction: string,
  source: SourceMaterial,
  ctx: NoteContext,
): Promise<{ html: string; declined: string[] }> {
  const result = await chatJson<{ content?: string; declined?: string[] }>({
    system: `${CLINICAL_GUARDRAILS}\n${contextBlock(ctx)}\n${EDIT_RULES}`,
    messages: [
      {
        role: "user",
        content: `Rewrite the "${section.title}" section of a clinical note.
${section.instructions ? `Section purpose: ${section.instructions}\n` : ""}Request: ${instruction || "Regenerate this section from the source material."}

Current section:
${plain(section.html)}

Source material:
${sourceText(source)}

Return {"content": "<the new section: plain text, blank lines between paragraphs, '- ' for bullets>", "declined": ["<each requested change you did not make, and what the source says instead>"]}.`,
      },
    ],
    maxTokens: 6000,
  });
  const text = result.content?.trim() ?? "";
  const declinedByWriter = (result.declined ?? []).filter((d) => typeof d === "string" && d.trim());
  if (!text) return { html: section.html, declined: declinedByWriter.length ? declinedByWriter : ["The assistant returned no text; nothing was changed."] };
  const problems = await unsupportedChanges([{ id: "s", title: section.title, before: plain(section.html), after: text }], source, ctx);
  // Any part of the request left undone means the clinician should see why before anything changes.
  if (problems.length || declinedByWriter.length) {
    return { html: section.html, declined: [...declinedByWriter, ...problems.map((p) => `“${p.claim}” — ${p.why}`)] };
  }
  return { html: textToHtml(text), declined: [] };
}

/**
 * "Edit with Assistant": applies a free-form instruction across the whole note. Sections whose new
 * content adds facts the session doesn't support are left unchanged and reported in `declined`.
 */
export async function editNote(
  sections: { id: string; title: string; html: string }[],
  instruction: string,
  source: SourceMaterial,
  ctx: NoteContext,
): Promise<{ sections: { id: string; title: string; html: string }[]; declined: string[] }> {
  const result = await chatJson<{ sections?: { id: string; content: string }[]; declined?: string[] }>({
    system: `${CLINICAL_GUARDRAILS}\n${contextBlock(ctx)}\n${EDIT_RULES}`,
    messages: [
      {
        role: "user",
        content: `Apply this edit to the clinical note: "${instruction}".
Change only what the request requires; keep other sections word-for-word.

Note sections:
${sections.map((s) => `### id="${s.id}" — ${s.title}\n${plain(s.html)}`).join("\n\n")}

Source material for fact checking:
${sourceText(source)}

Return {"sections": [{"id": "...", "content": "<plain text, blank lines between paragraphs, '- ' bullets>"}], "declined": ["<each requested change you did not make, and what the source says instead>"]} with every section.`,
      },
    ],
    maxTokens: 16000,
  });

  // Untouched sections keep their original HTML (and any formatting the clinician added).
  const changes = sections
    .map((s) => ({ id: s.id, title: s.title, before: plain(s.html), after: result.sections?.find((x) => x.id === s.id)?.content?.trim() ?? "" }))
    .filter((c) => c.after && plain(textToHtml(c.after)) !== c.before);

  const problems = await unsupportedChanges(changes, source, ctx);
  const rejected = new Set(problems.map((p) => p.id));
  const declined = [
    ...(result.declined ?? []).filter((d) => typeof d === "string" && d.trim()),
    ...problems.map((p) => `${sections.find((s) => s.id === p.id)?.title}: “${p.claim}” — ${p.why}`),
  ];
  return {
    sections: sections.map((s) => {
      const c = changes.find((x) => x.id === s.id);
      return c && !rejected.has(s.id) ? { ...s, html: textToHtml(c.after) } : s;
    }),
    declined,
  };
}

export interface PlanArea {
  id: string;
  title: string;
  goal: string;
  objectives: { id: string; text: string; status: "NOT_STARTED" | "EARLY" | "PROGRESSING" | "MET" }[];
  interventions: string[];
}

export async function generateTreatmentPlan(material: string, ctx: NoteContext): Promise<{ caseSnapshot: string; areas: PlanArea[] }> {
  const result = await chatJson<{ caseSnapshot: string; areas: Omit<PlanArea, "id">[] }>({
    system: `${CLINICAL_GUARDRAILS}\n${contextBlock(ctx)}`,
    messages: [
      {
        role: "user",
        content: `Draft a treatment plan from the clinical record below.
Return {"caseSnapshot": "<presentation and history, 1–3 paragraphs>", "areas": [{"title": "...", "goal": "<long-term goal>", "objectives": [{"text": "<measurable, time-bound objective>", "status": "NOT_STARTED|EARLY|PROGRESSING|MET"}], "interventions": ["<evidence-based intervention>"]}]}.
Use 2–4 treatment areas, 2–3 objectives each. Base status on documented progress.
Every objective must be measurable and time-bound: state what will change, by how much, how it is measured, and by when (e.g. "Within 8 weeks, reduce panic attacks from 3 to 1 or fewer per week, per the client's self-report log").

Clinical record:
${material}`,
      },
    ],
    maxTokens: 10000,
  });
  const rid = () => Math.random().toString(36).slice(2, 10);
  return {
    caseSnapshot: textToHtml(result.caseSnapshot ?? ""),
    areas: (result.areas ?? []).map((a) => ({
      id: rid(),
      title: a.title,
      goal: a.goal,
      objectives: (a.objectives ?? []).map((o) => ({ id: rid(), text: o.text, status: o.status ?? "NOT_STARTED" })),
      interventions: a.interventions ?? [],
    })),
  };
}

export interface SummaryContent {
  presentingConcerns: string;
  goals: string[];
  progress: string;
  interventions: string[];
  risk: string;
  nextSteps: string[];
}

export async function generateTreatmentSummary(material: string, ctx: NoteContext): Promise<SummaryContent> {
  return chatJson<SummaryContent>({
    system: `${CLINICAL_GUARDRAILS}\n${contextBlock(ctx)}`,
    messages: [
      {
        role: "user",
        content: `Summarise the course of treatment so far.
Return {"presentingConcerns": "...", "goals": ["..."], "progress": "...", "interventions": ["..."], "risk": "<documented risk factors (including whether a plan or intent was reported), protective factors, access to means, any safety plan and crisis resources, and current safety status — or 'No risk concerns documented.'>", "nextSteps": ["..."]}.

Clinical record (most recent last):
${material}`,
      },
    ],
    maxTokens: 6000,
  });
}

export interface ComplianceItem {
  criterionId: string;
  status: "pass" | "warn" | "fail";
  finding: string;
  suggestion: string;
}

export async function checkCompliance(
  noteText: string,
  criteria: { id: string; title: string; description: string }[],
): Promise<{ score: number; summary: string; items: ComplianceItem[] }> {
  const result = await chatJson<{ summary: string; items: ComplianceItem[] }>({
    system:
      "You audit psychotherapy documentation against payer documentation criteria. Be specific and quote the note where useful. Do not give legal advice.",
    messages: [
      {
        role: "user",
        content: `Evaluate the note against each criterion.
Criteria:
${criteria.map((c) => `- id="${c.id}" ${c.title}: ${c.description}`).join("\n")}

Return {"summary": "<2 sentences>", "items": [{"criterionId": "...", "status": "pass|warn|fail", "finding": "<what the note does or lacks>", "suggestion": "<concrete fix, or empty if pass>"}]} with one item per criterion.

Note:
${noteText}`,
      },
    ],
    maxTokens: 8000,
  });
  const items = result.items ?? [];
  const points = items.reduce((n, i) => n + (i.status === "pass" ? 1 : i.status === "warn" ? 0.5 : 0), 0);
  return { score: items.length ? Math.round((points / items.length) * 100) : 0, summary: result.summary ?? "", items };
}

export async function templateFromDocument(text: string) {
  return chatJson<{ name: string; description: string; category: string; sections: { title: string; instructions: string; format: string }[] }>({
    system: "You convert example clinical notes into reusable note templates.",
    messages: [
      {
        role: "user",
        content: `Turn this example note into a reusable template. Identify each section heading and write instructions describing what belongs there (not the example's content).
Return {"name": "...", "description": "...", "category": "PROGRESS|INTAKE|TREATMENT_PLAN|DISCHARGE|OTHER", "sections": [{"title": "...", "instructions": "...", "format": "paragraph|bullets|short"}]}.

Example note:
${text.slice(0, 60000)}`,
      },
    ],
    maxTokens: 6000,
  });
}

export async function formFromDocument(text: string) {
  return chatJson<{ name: string; description: string; kind: string; fields: { type: string; label: string; required?: boolean; options?: string[]; help?: string }[] }>({
    system: "You convert paper intake, consent and assessment forms into structured digital forms.",
    messages: [
      {
        role: "user",
        content: `Convert this form into fields. Field types: heading, paragraph (read-only text), short_text, long_text, email, phone, date, number, single_choice, multi_choice, yes_no, signature.
Keep the original wording of questions. Use "paragraph" for consent/legal text blocks.
Return {"name": "...", "description": "...", "kind": "INTAKE|CONSENT|ASSESSMENT|OTHER", "fields": [{"type": "...", "label": "...", "required": true, "options": ["..."], "help": "..."}]}.

Form text:
${text.slice(0, 60000)}`,
      },
    ],
    maxTokens: 12000,
  });
}

export function sectionsToText(sections: { title: string; html: string }[]) {
  // stripHtml also decodes entities, so the model and compliance checks see "&", not "&amp;".
  return sections.map((s) => `${s.title}\n${stripHtml(s.html).replace(/\s+/g, " ").trim()}`).join("\n\n");
}

export function plainTextToSections(text: string) {
  return [{ id: "body", title: "Note", html: textToHtml(text) }];
}
