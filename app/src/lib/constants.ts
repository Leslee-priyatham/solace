export const APP_NAME = "Solace";

export const ROLES = { ADMIN: "Admin", CLINICIAN: "Clinician", BILLER: "Biller" } as const;

export const CLIENT_STATUS = {
  ACTIVE: "Active",
  PROSPECT: "Prospect",
  INACTIVE: "Inactive",
  DISCHARGED: "Discharged",
} as const;

export const CLIENT_KIND = { INDIVIDUAL: "Individual", COUPLE: "Couple", FAMILY: "Family" } as const;

export const APPOINTMENT_STATUS = {
  REQUESTED: "Requested",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  LATE_CANCEL: "Late cancel",
  NO_SHOW: "No-show",
} as const;

export const CAPTURE_MODE = {
  IN_PERSON: "In-person",
  VIRTUAL: "Virtual",
  TELEHEALTH: "Telehealth",
  UPLOAD: "Uploaded recording",
  DICTATION: "Dictation",
  TEXT: "Written summary",
} as const;

export const SESSION_STATUS = {
  DRAFT: "Draft",
  RECORDING: "Recording",
  TRANSCRIBING: "Transcribing",
  GENERATING: "Writing note",
  READY: "Ready",
  ERROR: "Needs attention",
} as const;

export const INVOICE_STATUS = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIAL: "Partially paid",
  PAID: "Paid",
  VOID: "Void",
  WRITTEN_OFF: "Written off",
} as const;

export const PAYMENT_METHOD = {
  CARD: "Card",
  CASH: "Cash",
  CHECK: "Check",
  BANK_TRANSFER: "Bank transfer",
  INSURANCE: "Insurance",
  OTHER: "Other",
} as const;

export const CLAIM_STATUS = {
  DRAFT: "Draft",
  READY: "Ready to submit",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  PAID: "Paid",
  PARTIAL: "Partially paid",
  DENIED: "Denied",
  VOID: "Void",
} as const;

export const FORM_FIELD_TYPES = {
  heading: "Heading",
  paragraph: "Text block",
  short_text: "Short answer",
  long_text: "Long answer",
  email: "Email",
  phone: "Phone",
  date: "Date",
  number: "Number",
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  yes_no: "Yes / No",
  scale: "Scored scale",
  signature: "Signature",
} as const;

export const MODALITIES = [
  "ACT", "CBT", "CPT", "DBT", "EFT", "EMDR", "Exposure therapy", "Family systems", "Gottman method",
  "Humanistic", "IFS", "Motivational interviewing", "Mindfulness-based", "Narrative therapy",
  "Person-centered", "Play therapy", "Psychodynamic", "Solution-focused", "Somatic", "TF-CBT",
] as const;

export const CPT_CODES: { code: string; label: string; minutes?: number }[] = [
  { code: "90791", label: "Psychiatric diagnostic evaluation", minutes: 60 },
  { code: "90792", label: "Psychiatric diagnostic evaluation with medical services", minutes: 60 },
  { code: "90832", label: "Psychotherapy, 30 min", minutes: 30 },
  { code: "90834", label: "Psychotherapy, 45 min", minutes: 45 },
  { code: "90837", label: "Psychotherapy, 60 min", minutes: 60 },
  { code: "90839", label: "Psychotherapy for crisis, first 60 min", minutes: 60 },
  { code: "90840", label: "Psychotherapy for crisis, each additional 30 min", minutes: 30 },
  { code: "90846", label: "Family psychotherapy without patient", minutes: 50 },
  { code: "90847", label: "Family/couples psychotherapy with patient", minutes: 50 },
  { code: "90853", label: "Group psychotherapy", minutes: 60 },
  { code: "96127", label: "Brief emotional/behavioral assessment" },
  { code: "H0031", label: "Mental health assessment by non-physician" },
];

export const PLACE_OF_SERVICE: Record<string, string> = {
  "02": "Telehealth (not in patient's home)",
  "10": "Telehealth in patient's home",
  "11": "Office",
  "12": "Home",
  "53": "Community mental health center",
};

export const NOTE_CATEGORY = {
  PROGRESS: "Progress note",
  INTAKE: "Intake / assessment",
  TREATMENT_PLAN: "Treatment plan",
  DISCHARGE: "Discharge summary",
  CLIENT_NOTE: "Note for client",
  OTHER: "Other",
} as const;

export const OBJECTIVE_STATUS = {
  NOT_STARTED: "Not started",
  EARLY: "Early stage",
  PROGRESSING: "Progressing",
  MET: "Met",
} as const;

export const REPORT_METRICS: Record<string, { title: string; description: string }> = {
  sessions_over_time: { title: "Sessions over time", description: "Completed sessions per week" },
  caseload: { title: "Caseload overview", description: "Clients by status" },
  days_to_signoff: { title: "Days to sign off", description: "Average days from session to signed note" },
  revenue: { title: "Revenue", description: "Payments received per month" },
  outstanding: { title: "Outstanding balances", description: "Unpaid invoice totals by client" },
  appointment_outcomes: { title: "Appointment outcomes", description: "Completed, cancelled and no-show appointments" },
  measures: { title: "Measure trends", description: "Average PHQ-9 / GAD-7 scores over time" },
  new_clients: { title: "New clients", description: "Clients added per month" },
};
