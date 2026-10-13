import { PrismaClient } from "@prisma/client";

// SQLite cannot hold defaults on JSON columns, so they are applied here on create.
const JSON_DEFAULTS: Record<string, Record<string, unknown>> = {
  practice: { settings: {} },
  user: { preferences: {} },
  client: { modalities: [], notePrefs: {} },
  externalCalendar: { events: [] },
  session: { transcript: [], chapters: [], speakerMap: {}, analytics: {} },
  noteTemplate: { sections: [] },
  noteDocument: { sections: [] },
  treatmentPlan: { areas: [] },
  treatmentSummary: { content: {} },
  form: { fields: [] },
  formPacket: { formIds: [] },
  formRequest: { answers: {} },
  announcement: { clientIds: [] },
  superbill: { sessionIds: [] },
  claim: { diagnosisCodes: [], history: [] },
  insurancePayment: { lines: [] },
  complianceCriteriaGroup: { criteria: [] },
  dashboard: { filters: {} },
  importJob: { summary: {} },
};

function withDefaults(model: string, data: Record<string, unknown> | undefined) {
  const defaults = JSON_DEFAULTS[model];
  if (!defaults || !data) return data;
  const out = { ...data };
  for (const [key, value] of Object.entries(defaults)) {
    if (out[key] === undefined) out[key] = structuredClone(value);
  }
  return out;
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function createClient() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          args.data = withDefaults(lowerFirst(model), args.data as Record<string, unknown>) as typeof args.data;
          return query(args);
        },
        async createMany({ model, args, query }) {
          const m = lowerFirst(model);
          const data = Array.isArray(args.data) ? args.data : [args.data];
          args.data = data.map((d) => withDefaults(m, d as Record<string, unknown>)) as typeof args.data;
          return query(args);
        },
        async upsert({ model, args, query }) {
          args.create = withDefaults(lowerFirst(model), args.create as Record<string, unknown>) as typeof args.create;
          return query(args);
        },
      },
    },
  });
}

type Db = ReturnType<typeof createClient>;
const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
