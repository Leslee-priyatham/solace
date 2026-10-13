import "server-only";
import { db } from "@/lib/db";
import { date, dateTime, money, stripHtml } from "@/lib/format";
import { APP_NAME } from "@/lib/constants";
import { transcriptToText, type LabeledUtterance } from "./clinical";

export interface AssistantContext {
  clientId?: string | null;
  sessionId?: string | null;
}

export const QUICK_ACTIONS: Record<string, { label: string; prompt: string; needsClient?: boolean }> = {
  session_prep: { label: "Session prep", prompt: "Prepare me for my next session with this client: where we left off, open homework, treatment-plan objectives in progress, any risk notes, and three questions I could ask.", needsClient: true },
  case_consultation: { label: "Case consultation", prompt: "Act as a peer consultant on this case. Summarise the clinical picture, offer alternative conceptualisations, and suggest evidence-based approaches I might consider.", needsClient: true },
  insights: { label: "Insights", prompt: "What patterns do you notice across this client's sessions and measure scores? Include progress, stuck points and themes that recur.", needsClient: true },
  client_history: { label: "Client history", prompt: "Give me a concise chronological history of this client's treatment so far.", needsClient: true },
  treatment_plan: { label: "Treatment plan", prompt: "Review this client's treatment plan against recent sessions. Which objectives are progressing, which need updating, and what would you change?", needsClient: true },
  referrals: { label: "Referrals & resources", prompt: "Suggest appropriate referrals, self-help resources and psychoeducation materials for this client's presenting concerns.", needsClient: true },
  risk: { label: "Risk & safety", prompt: "Review the record for documented risk and protective factors. Summarise the current safety picture and anything I should follow up on. Do not infer risk that isn't documented.", needsClient: true },
  today: { label: "My day", prompt: "Give me an overview of today: appointments, unsigned notes, and anything that needs my attention." },
  unsigned: { label: "Unsigned notes", prompt: "Which of my notes are still unsigned? List them oldest first and suggest an order to finish them." },
  billing: { label: "Billing check", prompt: "Summarise outstanding invoices and unbilled sessions, and anything that looks overdue." },
};

export async function systemPrompt(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { memories: { orderBy: { createdAt: "asc" } } } });
  const skills = await db.assistantSkill.findMany();
  const prefs = (user?.preferences ?? {}) as { memory?: boolean; guidance?: string };
  return [
    `You are the ${APP_NAME} Assistant, a knowledgeable clinical and practice-management assistant for ${user?.firstName ?? "a"} — a licensed mental-health clinician.`,
    "Ground every clinical statement in the record provided below; say clearly when the record doesn't contain something. Never fabricate quotes, scores or risk findings.",
    "You support, not replace, clinical judgement. For safety concerns, encourage following the clinician's crisis protocol.",
    "Format answers in concise Markdown: short paragraphs, bullet lists, bold for key points. Today's date is " + date(new Date(), "EEEE, MMMM d, yyyy") + ".",
    prefs.guidance && `The clinician's standing guidance for you: ${prefs.guidance}`,
    prefs.memory !== false && user?.memories.length
      ? `Things the clinician asked you to remember:\n${user.memories.map((m) => `- ${m.content}`).join("\n")}`
      : "",
    skills.length
      ? `Skills (apply the matching one when the request fits):\n${skills.map((s) => `### ${s.name}\nUse when: ${s.description}\n${s.instructions}`).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Builds the record excerpt the assistant answers from. */
export async function buildContext(userId: string, ctx: AssistantContext): Promise<string> {
  const parts: string[] = [];

  if (ctx.sessionId) {
    const s = await db.session.findUnique({ where: { id: ctx.sessionId }, include: { documents: true } });
    if (s) {
      if (!ctx.clientId) ctx.clientId = s.clientId;
      parts.push(`## Current session (${dateTime(s.startedAt)}) — ${s.title ?? "Untitled"}`);
      const transcript = s.transcript as unknown as LabeledUtterance[];
      if (transcript.length) parts.push(`Transcript:\n${transcriptToText(transcript).slice(0, 60000)}`);
      else if (s.rawText) parts.push(`Clinician's notes:\n${s.rawText.slice(0, 30000)}`);
      for (const d of s.documents) {
        const secs = d.sections as unknown as { title: string; html: string }[];
        parts.push(`Note "${d.title}" (${d.status}):\n${secs.map((x) => `${x.title}: ${stripHtml(x.html)}`).join("\n")}`);
      }
    }
  }

  if (ctx.clientId) {
    const c = await db.client.findUnique({
      where: { id: ctx.clientId },
      include: {
        diagnoses: true,
        treatmentPlan: true,
        summary: true,
        measureScores: { orderBy: { takenAt: "asc" } },
        chartNotes: { orderBy: { date: "desc" }, take: 5 },
        appointments: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 },
        sessions: { orderBy: { startedAt: "desc" }, take: 8, include: { documents: true } },
      },
    });
    if (c) {
      parts.push(
        `## Client: ${c.firstName} ${c.lastName}${c.pronouns ? ` (${c.pronouns})` : ""}`,
        [
          `Status: ${c.status}. Type: ${c.kind}.`,
          c.dob && `DOB: ${date(c.dob)}.`,
          `Modalities: ${(c.modalities as string[]).join(", ") || "none recorded"}.`,
          `Diagnoses: ${c.diagnoses.map((d) => `${d.code} ${d.description}`).join("; ") || "none recorded"}.`,
          c.notes && `Clinician notes: ${c.notes}`,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (c.treatmentPlan) {
        const areas = c.treatmentPlan.areas as unknown as { title: string; goal: string; objectives: { text: string; status: string }[]; interventions: string[] }[];
        parts.push(
          `### Treatment plan\n${stripHtml(c.treatmentPlan.caseSnapshot)}\n${areas
            .map((a) => `- ${a.title}: ${a.goal}\n${a.objectives.map((o) => `  - [${o.status}] ${o.text}`).join("\n")}\n  Interventions: ${a.interventions.join(", ")}`)
            .join("\n")}`,
        );
      }
      if (c.measureScores.length) {
        parts.push(`### Measures\n${c.measureScores.map((m) => `- ${date(m.takenAt)} ${m.measure}: ${m.score} (${m.severity})`).join("\n")}`);
      }
      if (c.appointments.length) parts.push(`### Upcoming\n${c.appointments.map((a) => `- ${dateTime(a.startsAt)} (${a.status})`).join("\n")}`);
      for (const s of c.sessions.reverse()) {
        if (s.id === ctx.sessionId) continue;
        const note = s.documents[0];
        const body = note ? (note.sections as unknown as { title: string; html: string }[]).map((x) => `${x.title}: ${stripHtml(x.html)}`).join("\n") : s.synopsis ?? "";
        parts.push(`### Session ${date(s.startedAt)} — ${s.title ?? ""}\n${body.slice(0, 4000)}`);
      }
      for (const n of c.chartNotes) parts.push(`### Chart note ${date(n.date)} — ${n.title}\n${stripHtml(n.html).slice(0, 1500)}`);
    }
  }

  if (!ctx.clientId && !ctx.sessionId) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 864e5 * 2);
    const [appts, unsigned, invoices, clients] = await Promise.all([
      db.appointment.findMany({ where: { providerId: userId, startsAt: { gte: start, lt: end } }, include: { client: true }, orderBy: { startsAt: "asc" } }),
      db.noteDocument.findMany({ where: { status: "DRAFT", session: { providerId: userId } }, include: { session: { include: { client: true } } }, orderBy: { createdAt: "asc" }, take: 20 }),
      db.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL"] } }, include: { client: true }, take: 20 }),
      db.client.findMany({ where: { status: "ACTIVE" }, select: { firstName: true, lastName: true }, take: 100 }),
    ]);
    parts.push(
      "## Practice snapshot",
      `Today and tomorrow:\n${appts.map((a) => `- ${dateTime(a.startsAt)} ${a.client ? `${a.client.firstName} ${a.client.lastName}` : a.title ?? a.kind} (${a.status})`).join("\n") || "- No appointments"}`,
      `Unsigned notes:\n${unsigned.map((n) => `- ${n.title} — ${n.session?.client ? `${n.session.client.firstName} ${n.session.client.lastName}` : "unassigned"}, session ${date(n.session?.startedAt)}`).join("\n") || "- None"}`,
      `Open invoices:\n${invoices.map((i) => `- ${i.number} ${i.client.firstName} ${i.client.lastName}: ${money(i.totalCents - i.paidCents)} due ${date(i.dueDate)}`).join("\n") || "- None"}`,
      `Active clients (${clients.length}): ${clients.map((c) => `${c.firstName} ${c.lastName}`).join(", ")}`,
    );
  }

  return parts.join("\n\n");
}
