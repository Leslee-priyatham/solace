// Built-in content seeded on first run: note templates, form library, compliance criteria,
// diagnosis codes and assistant routines. Written for this project.

type Section = { id: string; title: string; instructions: string; format?: "paragraph" | "bullets" | "short" };

export const SYSTEM_TEMPLATES: {
  key: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  guidance?: string;
  sections: Section[];
}[] = [
  {
    key: "standard-progress",
    name: "Standard progress note",
    description: "Balanced narrative progress note that works for most individual sessions.",
    category: "PROGRESS",
    audience: "INDIVIDUAL",
    sections: [
      { id: "presentation", title: "Presentation", instructions: "How the client presented today: mood, affect, engagement, and any notable changes since last session." },
      { id: "themes", title: "Session content", instructions: "Main themes, concerns and events the client discussed, with brief supporting quotes where clinically useful." },
      { id: "interventions", title: "Interventions", instructions: "Specific therapeutic interventions the clinician used and the modality they come from.", format: "bullets" },
      { id: "response", title: "Client response", instructions: "How the client responded to interventions, insight gained, and observable progress or barriers." },
      { id: "risk", title: "Risk assessment", instructions: "Any discussion of suicidal or homicidal ideation, self-harm, substance use or safety concerns, and the outcome. If none were raised, state that no risk indicators were reported.", format: "short" },
      { id: "plan", title: "Plan", instructions: "Homework, focus for the next session, referrals, and next appointment.", format: "bullets" },
    ],
  },
  {
    key: "soap",
    name: "SOAP",
    description: "Subjective, Objective, Assessment, Plan.",
    category: "PROGRESS",
    audience: "ANY",
    sections: [
      { id: "subjective", title: "Subjective", instructions: "The client's self-report: symptoms, feelings, events and stressors since last session, in their words where useful." },
      { id: "objective", title: "Objective", instructions: "Clinician observations: appearance, behaviour, speech, affect, thought process, and any measure scores." },
      { id: "assessment", title: "Assessment", instructions: "Clinical interpretation: progress toward goals, diagnostic impressions, risk level and response to treatment." },
      { id: "plan", title: "Plan", instructions: "Next steps: interventions planned, homework, referrals and next session.", format: "bullets" },
    ],
  },
  {
    key: "dap",
    name: "DAP",
    description: "Data, Assessment, Plan.",
    category: "PROGRESS",
    audience: "ANY",
    sections: [
      { id: "data", title: "Data", instructions: "Objective and subjective information from the session: what was discussed, observed and done." },
      { id: "assessment", title: "Assessment", instructions: "The clinician's interpretation of the data, progress toward goals, and current risk." },
      { id: "plan", title: "Plan", instructions: "Interventions and tasks before the next session, and its focus.", format: "bullets" },
    ],
  },
  {
    key: "birp",
    name: "BIRP",
    description: "Behavior, Intervention, Response, Plan.",
    category: "PROGRESS",
    audience: "ANY",
    sections: [
      { id: "behavior", title: "Behavior", instructions: "The client's presentation, reported symptoms and observed behaviour." },
      { id: "intervention", title: "Intervention", instructions: "Therapeutic interventions used and their goal-related rationale.", format: "bullets" },
      { id: "response", title: "Response", instructions: "How the client responded to each intervention." },
      { id: "plan", title: "Plan", instructions: "Plan for the next session and any assigned tasks.", format: "bullets" },
    ],
  },
  {
    key: "girp",
    name: "GIRP",
    description: "Goals, Intervention, Response, Plan.",
    category: "PROGRESS",
    audience: "ANY",
    sections: [
      { id: "goals", title: "Goals", instructions: "Treatment-plan goals addressed in this session." },
      { id: "intervention", title: "Intervention", instructions: "Interventions used to work toward those goals.", format: "bullets" },
      { id: "response", title: "Response", instructions: "Client response and progress toward each goal." },
      { id: "plan", title: "Plan", instructions: "Next steps toward the goals.", format: "bullets" },
    ],
  },
  {
    key: "pirp",
    name: "PIRP",
    description: "Problem, Intervention, Response, Plan.",
    category: "PROGRESS",
    audience: "ANY",
    sections: [
      { id: "problem", title: "Problem", instructions: "The presenting problem or symptom focus of this session." },
      { id: "intervention", title: "Intervention", instructions: "Interventions used to address the problem.", format: "bullets" },
      { id: "response", title: "Response", instructions: "How the client responded." },
      { id: "plan", title: "Plan", instructions: "Plan going forward.", format: "bullets" },
    ],
  },
  {
    key: "emdr",
    name: "EMDR progress note",
    description: "Tracks EMDR phase, target memory, SUD/VOC ratings and installation.",
    category: "PROGRESS",
    audience: "INDIVIDUAL",
    sections: [
      { id: "phase", title: "Phase and target", instructions: "EMDR phase(s) worked in, target memory or image, negative and positive cognitions.", format: "bullets" },
      { id: "ratings", title: "SUD and VOC", instructions: "Starting and ending SUD (0–10) and VOC (1–7) ratings if measured.", format: "short" },
      { id: "processing", title: "Processing", instructions: "Bilateral stimulation sets, associations that emerged, body sensations and blocks." },
      { id: "closure", title: "Closure and stabilization", instructions: "Containment, grounding or resourcing used and the client's state at the end." },
      { id: "plan", title: "Plan", instructions: "Targets for next session and between-session self-care.", format: "bullets" },
    ],
  },
  {
    key: "couples",
    name: "Couples progress note",
    description: "Relational focus: interaction patterns, each partner's perspective, and joint goals.",
    category: "PROGRESS",
    audience: "COUPLE",
    sections: [
      { id: "attendance", title: "Attendance and presentation", instructions: "Who attended and how each partner presented.", format: "short" },
      { id: "perspectives", title: "Each partner's perspective", instructions: "Key concerns raised by each partner, attributed by name." },
      { id: "patterns", title: "Relational patterns", instructions: "Observed interaction cycles, communication patterns and attachment dynamics." },
      { id: "interventions", title: "Interventions", instructions: "Couples interventions used.", format: "bullets" },
      { id: "plan", title: "Plan", instructions: "Joint and individual tasks, and focus for next session.", format: "bullets" },
    ],
  },
  {
    key: "intake",
    name: "Intake assessment",
    description: "Comprehensive first-session biopsychosocial assessment.",
    category: "INTAKE",
    audience: "INDIVIDUAL",
    sections: [
      { id: "reason", title: "Reason for referral", instructions: "Presenting problem in the client's words and who referred them." },
      { id: "history", title: "History of presenting problem", instructions: "Onset, duration, severity, triggers and what has helped or not." },
      { id: "psych", title: "Psychiatric and treatment history", instructions: "Prior diagnoses, therapy, hospitalisations and medications." },
      { id: "medical", title: "Medical history", instructions: "Relevant medical conditions, medications and sleep/appetite." },
      { id: "substance", title: "Substance use", instructions: "Alcohol, drugs and other substances: pattern and impact.", format: "short" },
      { id: "social", title: "Social and family history", instructions: "Family of origin, relationships, supports, culture, work or school, legal and housing." },
      { id: "mse", title: "Mental status exam", instructions: "Appearance, behaviour, speech, mood, affect, thought process and content, perception, cognition, insight and judgement.", format: "bullets" },
      { id: "risk", title: "Risk assessment", instructions: "Suicidal and homicidal ideation, self-harm, protective factors and overall risk level." },
      { id: "diagnosis", title: "Diagnostic impressions", instructions: "Working diagnoses with ICD-10 codes and rationale, only if supported by the material." },
      { id: "plan", title: "Recommendations and plan", instructions: "Recommended level of care, frequency, modality and initial goals.", format: "bullets" },
    ],
  },
  {
    key: "discharge",
    name: "Discharge summary",
    description: "Closing summary of the full course of treatment.",
    category: "DISCHARGE",
    audience: "ANY",
    sections: [
      { id: "course", title: "Course of treatment", instructions: "Dates, number of sessions, modalities and focus of treatment." },
      { id: "progress", title: "Progress toward goals", instructions: "Outcome for each treatment goal." },
      { id: "reason", title: "Reason for discharge", instructions: "Why treatment is ending.", format: "short" },
      { id: "recommendations", title: "Recommendations", instructions: "Aftercare, referrals and relapse-prevention plan.", format: "bullets" },
    ],
  },
  {
    key: "client-note",
    name: "Session recap for client",
    description: "Warm, plain-language recap the client can read in their portal.",
    category: "CLIENT_NOTE",
    audience: "ANY",
    guidance: "Write to the client in second person, warmly and in plain language. Never include diagnoses, risk wording or clinical jargon.",
    sections: [
      { id: "recap", title: "What we talked about", instructions: "A short recap of the main topics." },
      { id: "insights", title: "What stood out", instructions: "Strengths and insights the client showed.", format: "bullets" },
      { id: "practice", title: "To practise this week", instructions: "Agreed homework or practices.", format: "bullets" },
    ],
  },
];

type Field = { id: string; type: string; label: string; required?: boolean; options?: string[]; scores?: number[]; help?: string };

const FREQ = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

function scale(id: string, label: string): Field {
  return { id, type: "scale", label, required: true, options: FREQ, scores: [0, 1, 2, 3] };
}

export const FORM_LIBRARY: { key: string; name: string; description: string; kind: string; measure?: string; fields: Field[] }[] = [
  {
    key: "phq9",
    name: "PHQ-9 (depression)",
    description: "Patient Health Questionnaire-9. Scored 0–27.",
    kind: "ASSESSMENT",
    measure: "PHQ9",
    fields: [
      { id: "intro", type: "paragraph", label: "Over the last 2 weeks, how often have you been bothered by any of the following problems?" },
      scale("q1", "Little interest or pleasure in doing things"),
      scale("q2", "Feeling down, depressed, or hopeless"),
      scale("q3", "Trouble falling or staying asleep, or sleeping too much"),
      scale("q4", "Feeling tired or having little energy"),
      scale("q5", "Poor appetite or overeating"),
      scale("q6", "Feeling bad about yourself — or that you are a failure or have let yourself or your family down"),
      scale("q7", "Trouble concentrating on things, such as reading the newspaper or watching television"),
      scale("q8", "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual"),
      scale("q9", "Thoughts that you would be better off dead or of hurting yourself in some way"),
      { id: "difficulty", type: "single_choice", label: "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?", options: ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"] },
    ],
  },
  {
    key: "gad7",
    name: "GAD-7 (anxiety)",
    description: "Generalized Anxiety Disorder-7. Scored 0–21.",
    kind: "ASSESSMENT",
    measure: "GAD7",
    fields: [
      { id: "intro", type: "paragraph", label: "Over the last 2 weeks, how often have you been bothered by the following problems?" },
      scale("q1", "Feeling nervous, anxious, or on edge"),
      scale("q2", "Not being able to stop or control worrying"),
      scale("q3", "Worrying too much about different things"),
      scale("q4", "Trouble relaxing"),
      scale("q5", "Being so restless that it is hard to sit still"),
      scale("q6", "Becoming easily annoyed or irritable"),
      scale("q7", "Feeling afraid, as if something awful might happen"),
    ],
  },
  {
    key: "intake",
    name: "Adult intake questionnaire",
    description: "Contact details, history and goals before the first session.",
    kind: "INTAKE",
    fields: [
      { id: "h1", type: "heading", label: "About you" },
      { id: "name", type: "short_text", label: "Full legal name", required: true },
      { id: "preferred", type: "short_text", label: "Name you would like us to use" },
      { id: "dob", type: "date", label: "Date of birth", required: true },
      { id: "pronouns", type: "short_text", label: "Pronouns" },
      { id: "phone", type: "phone", label: "Phone number", required: true },
      { id: "address", type: "long_text", label: "Home address" },
      { id: "h2", type: "heading", label: "Emergency contact" },
      { id: "ec_name", type: "short_text", label: "Name", required: true },
      { id: "ec_rel", type: "short_text", label: "Relationship" },
      { id: "ec_phone", type: "phone", label: "Phone", required: true },
      { id: "h3", type: "heading", label: "What brings you here" },
      { id: "reason", type: "long_text", label: "What would you like help with?", required: true },
      { id: "duration", type: "single_choice", label: "How long has this been going on?", options: ["Less than a month", "1–6 months", "6–12 months", "More than a year"] },
      { id: "prior", type: "yes_no", label: "Have you been in therapy before?" },
      { id: "prior_detail", type: "long_text", label: "If yes, what was helpful or unhelpful?" },
      { id: "meds", type: "long_text", label: "Current medications and dosages" },
      { id: "goals", type: "long_text", label: "What would you like to be different at the end of therapy?" },
      { id: "safety", type: "yes_no", label: "In the past month, have you had thoughts of harming yourself or others?", help: "If you are in immediate danger, call your local emergency number." },
    ],
  },
  {
    key: "consent",
    name: "Informed consent for therapy",
    description: "Practice policies, confidentiality limits and client signature.",
    kind: "CONSENT",
    fields: [
      { id: "p1", type: "paragraph", label: "Therapy is a collaborative process. Results cannot be guaranteed, and discussing difficult topics can bring up uncomfortable feelings. You may ask questions about your treatment or end it at any time." },
      { id: "p2", type: "paragraph", label: "What you share is confidential, with legal exceptions: imminent risk of serious harm to yourself or others, suspected abuse or neglect of a child or vulnerable adult, or a valid court order." },
      { id: "p3", type: "paragraph", label: "Sessions cancelled with less than 24 hours' notice may be charged the practice's late-cancellation fee." },
      { id: "p4", type: "paragraph", label: "With your permission, sessions may be recorded to produce clinical documentation. Recordings are processed securely and you may withdraw this permission at any time." },
      { id: "agree", type: "yes_no", label: "I have read and understood this information and consent to treatment.", required: true },
      { id: "record", type: "yes_no", label: "I consent to sessions being recorded for documentation purposes." },
      { id: "sig", type: "signature", label: "Signature (type your full name)", required: true },
    ],
  },
  {
    key: "release",
    name: "Authorization to release information",
    description: "Permission to share records with a named third party.",
    kind: "CONSENT",
    fields: [
      { id: "recipient", type: "short_text", label: "Person or organisation to share with", required: true },
      { id: "purpose", type: "long_text", label: "Purpose of disclosure", required: true },
      { id: "info", type: "multi_choice", label: "Information to share", options: ["Attendance", "Diagnosis", "Treatment plan", "Progress summary", "Full records"], required: true },
      { id: "expires", type: "date", label: "This authorization expires on" },
      { id: "p1", type: "paragraph", label: "I understand I can revoke this authorization in writing at any time, except where action has already been taken based on it." },
      { id: "sig", type: "signature", label: "Signature (type your full name)", required: true },
    ],
  },
  {
    key: "sms",
    name: "Text message reminder consent",
    description: "Opt-in for appointment reminders by SMS.",
    kind: "CONSENT",
    fields: [
      { id: "phone", type: "phone", label: "Mobile number", required: true },
      { id: "p1", type: "paragraph", label: "Text messages are not a secure channel. Reminders contain only the date and time of your appointment. Message and data rates may apply; reply STOP to opt out." },
      { id: "agree", type: "yes_no", label: "I agree to receive appointment reminders by text message.", required: true },
      { id: "sig", type: "signature", label: "Signature (type your full name)", required: true },
    ],
  },
];

export const MEASURE_SEVERITY: Record<string, { max: number; bands: [number, string][] }> = {
  PHQ9: { max: 27, bands: [[4, "Minimal"], [9, "Mild"], [14, "Moderate"], [19, "Moderately severe"], [27, "Severe"]] },
  GAD7: { max: 21, bands: [[4, "Minimal"], [9, "Mild"], [14, "Moderate"], [21, "Severe"]] },
};

export function severity(measure: string, score: number) {
  const m = MEASURE_SEVERITY[measure];
  if (!m) return "";
  return m.bands.find(([max]) => score <= max)?.[1] ?? "";
}

export const COMPLIANCE_GROUPS: { name: string; description: string; criteria: { id: string; title: string; description: string }[] }[] = [
  {
    name: "Standard psychotherapy documentation",
    description: "Common elements payers expect in an outpatient psychotherapy progress note.",
    criteria: [
      { id: "identity", title: "Session identifiers", description: "Date, duration or start/stop times, modality (in-person/telehealth) and participants are documented." },
      { id: "medical_necessity", title: "Medical necessity", description: "Symptoms and functional impairment that justify continued treatment are described." },
      { id: "diagnosis_link", title: "Link to diagnosis", description: "Session content connects to the client's diagnosis." },
      { id: "goals", title: "Treatment plan goals", description: "The note references the treatment plan goals or objectives addressed." },
      { id: "interventions", title: "Specific interventions", description: "Named, specific therapeutic interventions are documented, not just 'supportive therapy'." },
      { id: "response", title: "Client response", description: "The client's response to interventions and progress are documented." },
      { id: "risk", title: "Risk assessment", description: "Safety/risk is assessed or explicitly noted as not indicated." },
      { id: "plan", title: "Plan", description: "Next steps and the next appointment are documented." },
      { id: "signature", title: "Clinician signature", description: "The note is signed by the rendering clinician with credentials." },
    ],
  },
  {
    name: "Telehealth add-on",
    description: "Extra elements commonly required for telehealth sessions.",
    criteria: [
      { id: "consent", title: "Telehealth consent", description: "The client's consent to telehealth is documented or referenced." },
      { id: "location", title: "Client location", description: "The client's physical location (state/address) during the session is documented." },
      { id: "platform", title: "Platform", description: "The audio-video or audio-only platform is documented." },
      { id: "safety", title: "Emergency plan", description: "An emergency contact or safety plan for the remote session is referenced." },
    ],
  },
];

export const DEFAULT_ROUTINES: { name: string; description: string; prompt: string; trigger: string; timeOfDay?: string }[] = [
  {
    name: "Session prep",
    description: "Before each session: a short brief on where you left off and what to follow up.",
    prompt: "Prepare me for my upcoming session with this client: last session's themes, open homework, treatment-plan objectives in progress, any risk notes, and 3 suggested questions.",
    trigger: "BEFORE_SESSION",
  },
  {
    name: "Unsigned notes reminder",
    description: "Every morning: list notes still waiting for your signature.",
    prompt: "List my unsigned notes, oldest first, with how many days each has been waiting, and suggest which to finish first.",
    trigger: "DAILY",
    timeOfDay: "08:00",
  },
  {
    name: "Daily schedule overview",
    description: "Every morning: today's appointments with a one-line context for each client.",
    prompt: "Give me an overview of today's appointments with a one-line clinical context for each client and anything I should prepare.",
    trigger: "DAILY",
    timeOfDay: "07:30",
  },
];

// Common ICD-10-CM codes in outpatient mental health.
export const ICD10: [string, string][] = [
  ["F01.50", "Vascular dementia, unspecified severity, without behavioral disturbance"],
  ["F10.10", "Alcohol abuse, uncomplicated"],
  ["F10.20", "Alcohol dependence, uncomplicated"],
  ["F11.20", "Opioid dependence, uncomplicated"],
  ["F12.10", "Cannabis abuse, uncomplicated"],
  ["F12.20", "Cannabis dependence, uncomplicated"],
  ["F17.210", "Nicotine dependence, cigarettes, uncomplicated"],
  ["F20.9", "Schizophrenia, unspecified"],
  ["F25.0", "Schizoaffective disorder, bipolar type"],
  ["F25.1", "Schizoaffective disorder, depressive type"],
  ["F31.0", "Bipolar disorder, current episode hypomanic"],
  ["F31.81", "Bipolar II disorder"],
  ["F31.9", "Bipolar disorder, unspecified"],
  ["F32.0", "Major depressive disorder, single episode, mild"],
  ["F32.1", "Major depressive disorder, single episode, moderate"],
  ["F32.2", "Major depressive disorder, single episode, severe without psychotic features"],
  ["F32.9", "Major depressive disorder, single episode, unspecified"],
  ["F32.A", "Depression, unspecified"],
  ["F33.0", "Major depressive disorder, recurrent, mild"],
  ["F33.1", "Major depressive disorder, recurrent, moderate"],
  ["F33.2", "Major depressive disorder, recurrent severe without psychotic features"],
  ["F33.41", "Major depressive disorder, recurrent, in partial remission"],
  ["F33.9", "Major depressive disorder, recurrent, unspecified"],
  ["F34.1", "Dysthymic disorder"],
  ["F40.00", "Agoraphobia, unspecified"],
  ["F40.10", "Social phobia, unspecified"],
  ["F40.232", "Fear of other medical care"],
  ["F40.9", "Phobic anxiety disorder, unspecified"],
  ["F41.0", "Panic disorder [episodic paroxysmal anxiety]"],
  ["F41.1", "Generalized anxiety disorder"],
  ["F41.8", "Other specified anxiety disorders"],
  ["F41.9", "Anxiety disorder, unspecified"],
  ["F42.2", "Mixed obsessional thoughts and acts"],
  ["F42.9", "Obsessive-compulsive disorder, unspecified"],
  ["F43.0", "Acute stress reaction"],
  ["F43.10", "Post-traumatic stress disorder, unspecified"],
  ["F43.11", "Post-traumatic stress disorder, acute"],
  ["F43.12", "Post-traumatic stress disorder, chronic"],
  ["F43.20", "Adjustment disorder, unspecified"],
  ["F43.21", "Adjustment disorder with depressed mood"],
  ["F43.22", "Adjustment disorder with anxiety"],
  ["F43.23", "Adjustment disorder with mixed anxiety and depressed mood"],
  ["F43.24", "Adjustment disorder with disturbance of conduct"],
  ["F43.25", "Adjustment disorder with mixed disturbance of emotions and conduct"],
  ["F43.81", "Prolonged grief disorder"],
  ["F44.9", "Dissociative and conversion disorder, unspecified"],
  ["F45.1", "Undifferentiated somatoform disorder"],
  ["F50.00", "Anorexia nervosa, unspecified"],
  ["F50.2", "Bulimia nervosa"],
  ["F50.81", "Binge eating disorder"],
  ["F51.01", "Primary insomnia"],
  ["F60.3", "Borderline personality disorder"],
  ["F60.5", "Obsessive-compulsive personality disorder"],
  ["F63.81", "Intermittent explosive disorder"],
  ["F64.0", "Transsexualism / gender dysphoria in adolescents and adults"],
  ["F84.0", "Autistic disorder"],
  ["F90.0", "Attention-deficit hyperactivity disorder, predominantly inattentive type"],
  ["F90.1", "Attention-deficit hyperactivity disorder, predominantly hyperactive type"],
  ["F90.2", "Attention-deficit hyperactivity disorder, combined type"],
  ["F91.3", "Oppositional defiant disorder"],
  ["F93.0", "Separation anxiety disorder of childhood"],
  ["F94.1", "Reactive attachment disorder of childhood"],
  ["F98.0", "Enuresis not due to a substance or known physiological condition"],
  ["F99", "Mental disorder, not otherwise specified"],
  ["Z59.00", "Homelessness, unspecified"],
  ["Z62.820", "Parent-biological child conflict"],
  ["Z63.0", "Problems in relationship with spouse or partner"],
  ["Z63.4", "Disappearance and death of family member"],
  ["Z63.5", "Disruption of family by separation and divorce"],
  ["Z65.8", "Other specified problems related to psychosocial circumstances"],
  ["Z69.010", "Encounter for mental health services for victim of parental child abuse"],
  ["Z71.89", "Other specified counseling"],
  ["Z73.3", "Stress, not elsewhere classified"],
];
