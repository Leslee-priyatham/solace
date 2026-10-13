import "server-only";
import { db } from "./db";
import { token } from "./crypto";
import { COMPLIANCE_GROUPS, DEFAULT_ROUTINES, FORM_LIBRARY, SYSTEM_TEMPLATES } from "./library";
import { textToHtml } from "./format";

export async function nextMrn() {
  const count = await db.client.count();
  return `MRN-${String(1001 + count).padStart(5, "0")}`;
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "practice";
}

/** Creates the library content every practice starts with. Safe to call more than once. */
export async function seedLibrary() {
  if ((await db.noteTemplate.count({ where: { isSystem: true } })) === 0) {
    for (const t of SYSTEM_TEMPLATES) {
      await db.noteTemplate.create({
        data: {
          name: t.name,
          description: t.description,
          category: t.category,
          audience: t.audience,
          guidance: t.guidance,
          sections: t.sections,
          isSystem: true,
        },
      });
    }
  }
  if ((await db.form.count({ where: { isLibrary: true } })) === 0) {
    for (const f of FORM_LIBRARY) {
      await db.form.create({
        data: { name: f.name, description: f.description, kind: f.kind, measure: f.measure, fields: f.fields, isLibrary: true },
      });
    }
  }
  if ((await db.complianceCriteriaGroup.count()) === 0) {
    for (const g of COMPLIANCE_GROUPS) {
      await db.complianceCriteriaGroup.create({ data: { ...g, isSystem: true } });
    }
  }
  if ((await db.assistantRoutine.count()) === 0) {
    for (const r of DEFAULT_ROUTINES) await db.assistantRoutine.create({ data: { ...r, isBuiltIn: true } });
  }
  if ((await db.service.count()) === 0) {
    await db.service.createMany({
      data: [
        { name: "Therapy session", cpt: "90834", durationMin: 50, rateCents: 15000, sortOrder: 0 },
        { name: "Intake session", cpt: "90791", durationMin: 75, rateCents: 20000, sortOrder: 1 },
      ],
    });
  }
  if ((await db.dashboard.count()) === 0) {
    const d = await db.dashboard.create({ data: { name: "Practice overview" } });
    const tiles = [
      ["sessions_over_time", "Sessions over time", 2],
      ["caseload", "Caseload overview", 1],
      ["days_to_signoff", "Days to sign off", 1],
      ["revenue", "Revenue", 2],
      ["appointment_outcomes", "Appointment outcomes", 1],
      ["outstanding", "Outstanding balances", 1],
    ] as const;
    for (const [i, [metric, title, width]] of tiles.entries()) {
      await db.dashboardTile.create({ data: { dashboardId: d.id, metric, title, width, sortOrder: i } });
    }
  }
}

const DEMO_TRANSCRIPT_1: [number, "PROVIDER" | "CLIENT", string][] = [
  [2, "PROVIDER", "Hi Jordan, come on in. How has the week been since we last met?"],
  [8, "CLIENT", "Honestly, up and down. Work has been a lot. I had two late nights finishing a launch and I barely slept."],
  [17, "PROVIDER", "That sounds draining. On our usual zero-to-ten scale, where would you put your anxiety this week?"],
  [23, "CLIENT", "Probably a seven most days. It spikes on Sunday evenings when I start thinking about the week."],
  [31, "PROVIDER", "Sunday evenings again. What goes through your mind when it spikes?"],
  [36, "CLIENT", "That I'm going to miss something and everyone will realise I'm not actually good at my job."],
  [44, "PROVIDER", "That's the 'I'll be found out' thought we noticed last time. How strongly do you believe it in the moment?"],
  [50, "CLIENT", "In the moment, like ninety percent. Afterwards, maybe forty."],
  [57, "PROVIDER", "Let's look at the evidence together. What actually happened with the launch?"],
  [63, "CLIENT", "It went fine. My manager thanked the team. I guess nothing I worried about actually happened."],
  [72, "PROVIDER", "So the prediction was that you'd miss something important, and the outcome was a successful launch and recognition. What would be a more balanced thought?"],
  [84, "CLIENT", "Maybe that I'm stretched, but I'm still doing good work. Being tired doesn't mean I'm failing."],
  [93, "PROVIDER", "That's a really clear reframe. I'd like you to try writing that down on Sunday evenings this week, along with one piece of evidence from the week."],
  [103, "CLIENT", "I can do that. I also want to try the breathing exercise before bed, it helped the one time I did it."],
  [111, "PROVIDER", "Great. Any thoughts of harming yourself when things have felt heavy?"],
  [116, "CLIENT", "No, nothing like that. Just exhausted."],
  [120, "PROVIDER", "Thank you for checking in on that with me. Same time next week?"],
  [124, "CLIENT", "Yes, that works."],
];

/** Adds a clearly labelled demo client so the workspace is explorable on day one. */
export async function seedDemoClient(providerId: string) {
  if (await db.client.findFirst({ where: { isDemo: true } })) return;
  const soap = await db.noteTemplate.findFirst({ where: { isSystem: true, name: "SOAP" } });
  const client = await db.client.create({
    data: {
      mrn: await nextMrn(),
      firstName: "Jordan",
      lastName: "Rivera (demo)",
      email: "jordan.demo@example.com",
      pronouns: "they/them",
      status: "ACTIVE",
      modalities: ["CBT"],
      portalToken: token(),
      isDemo: true,
      providerId,
      diagnoses: { create: [{ code: "F41.1", description: "Generalized anxiety disorder", sortOrder: 0 }] },
    },
  });

  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(17, 0, 0, 0);
  const transcript = DEMO_TRANSCRIPT_1.map(([t, speaker, text], i) => ({
    start: t,
    end: DEMO_TRANSCRIPT_1[i + 1]?.[0] ?? t + 4,
    speaker,
    text,
  }));
  const session = await db.session.create({
    data: {
      clientId: client.id,
      providerId,
      title: "Testing the 'found out' thought after a work launch",
      synopsis: "Client linked Sunday-evening anxiety spikes to fear of being found incompetent and practised cognitive restructuring with evidence from a successful launch.",
      captureMode: "IN_PERSON",
      status: "READY",
      startedAt: start,
      endedAt: new Date(start.getTime() + 128 * 1000),
      durationSec: 128,
      transcript,
      chapters: [
        { title: "Check-in and anxiety rating", start: 2 },
        { title: "Sunday-evening thoughts", start: 31 },
        { title: "Evidence review and reframe", start: 57 },
        { title: "Homework and safety check", start: 93 },
      ],
      analytics: { providerSec: 64, clientSec: 54, silenceSec: 10 },
      isDemo: true,
      cpt: "90834",
      feeCents: 15000,
    },
  });
  await db.noteDocument.create({
    data: {
      sessionId: session.id,
      clientId: client.id,
      templateId: soap?.id,
      title: "SOAP",
      status: "DRAFT",
      sections: [
        {
          id: "subjective",
          title: "Subjective",
          html: textToHtml(
            "Client reported a difficult week with two late nights to complete a work launch and poor sleep. Rated anxiety 7/10 on most days, peaking on Sunday evenings when anticipating the work week. Identified the recurring thought \"I'm going to miss something and everyone will realise I'm not good at my job,\" believed at 90% in the moment and 40% afterwards.",
          ),
        },
        {
          id: "objective",
          title: "Objective",
          html: textToHtml("Client was alert, cooperative and engaged. Affect anxious but reactive; speech normal in rate and volume. Thought process linear and goal-directed."),
        },
        {
          id: "assessment",
          title: "Assessment",
          html: textToHtml(
            "Symptoms remain consistent with generalized anxiety disorder, with anticipatory anxiety tied to performance-related core beliefs. Client engaged well in cognitive restructuring and generated a balanced alternative thought, indicating growing skill in challenging automatic thoughts. Client denied thoughts of self-harm; no risk indicators reported.",
          ),
        },
        {
          id: "plan",
          title: "Plan",
          html: textToHtml("- Record the balanced thought and one piece of supporting evidence each Sunday evening\n- Practise paced breathing before bed\n- Continue weekly CBT; review thought records next session"),
        },
      ],
    },
  });

  await db.treatmentPlan.create({
    data: {
      clientId: client.id,
      caseSnapshot: textToHtml(
        "Jordan is an adult seeking help with persistent worry and anticipatory anxiety related to work performance, with sleep disruption during high-pressure periods. They describe a long-standing belief that they will be 'found out' as inadequate despite consistently positive feedback.",
      ),
      areas: [
        {
          id: "a1",
          title: "Anticipatory anxiety",
          goal: "Reduce the frequency and intensity of anticipatory anxiety so it no longer disrupts evenings and sleep.",
          objectives: [
            { id: "o1", text: "Within 6 weeks, rate Sunday-evening anxiety at 4/10 or below on most weeks.", status: "EARLY" },
            { id: "o2", text: "Complete at least 3 thought records per week for 4 consecutive weeks.", status: "PROGRESSING" },
          ],
          interventions: ["Cognitive restructuring", "Thought records", "Paced breathing"],
        },
        {
          id: "a2",
          title: "Sleep",
          goal: "Restore a consistent sleep routine during busy work periods.",
          objectives: [{ id: "o3", text: "Sleep at least 7 hours on 5 nights per week within 8 weeks.", status: "NOT_STARTED" }],
          interventions: ["Sleep hygiene psychoeducation", "Wind-down routine planning"],
        },
      ],
      generatedAt: new Date(),
    },
  });

  // An upcoming appointment so the calendar and home page have something on them.
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(17, 0, 0, 0);
  const service = await db.service.findFirst({ where: { cpt: "90834" } });
  await db.appointment.create({
    data: {
      clientId: client.id,
      providerId,
      serviceId: service?.id,
      startsAt: next,
      endsAt: new Date(next.getTime() + 50 * 60 * 1000),
      modality: "TELEHEALTH",
      title: "Therapy session",
    },
  });
  await db.measureScore.createMany({
    data: [
      { clientId: client.id, measure: "GAD7", score: 15, severity: "Severe", takenAt: new Date(Date.now() - 28 * 864e5) },
      { clientId: client.id, measure: "GAD7", score: 13, severity: "Moderate", takenAt: new Date(Date.now() - 14 * 864e5) },
      { clientId: client.id, measure: "GAD7", score: 11, severity: "Moderate", takenAt: new Date(Date.now() - 1 * 864e5) },
      { clientId: client.id, measure: "PHQ9", score: 9, severity: "Mild", takenAt: new Date(Date.now() - 28 * 864e5) },
      { clientId: client.id, measure: "PHQ9", score: 7, severity: "Mild", takenAt: new Date(Date.now() - 1 * 864e5) },
    ],
  });
}
