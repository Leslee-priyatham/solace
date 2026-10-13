// Experiment harness: shared context (app modules, model routing, HTTP client, judge, scoring helpers).
import { load, appRequire, HERE } from "./load.mjs";

export const CONFIGURED_MODEL = "gemini-3.5-flash-lite"; // after the fix (was gemini-3.8-flash)
export const CONFIGURED_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
export const GEN_MODEL = process.env.GEN_MODEL || "gemini-3.5-flash-lite";
export const JUDGE_MODEL = process.env.JUDGE_MODEL || "gemini-3.6-flash";
export const BASE_URL = process.env.SOLACE_URL || "http://localhost:3100";

// ───────── fetch instrumentation ─────────
// The app's Gemini client has no timeout and no retry. For *quality* experiments the harness adds both
// (so a stalled upstream doesn't eat the budget) and re-routes the configured model to GEN_MODEL.
// Availability experiments switch this off with net.raw = true.
// Free-tier keys have small per-model daily quotas, so when a model's daily quota is exhausted the
// harness falls through this chain and records which model actually served every call.
import { AsyncLocalStorage } from "node:async_hooks";
export const als = new AsyncLocalStorage();
export const FALLBACK_CHAIN = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3-flash-preview"];
export const exhausted = new Set();
const realFetch = globalThis.fetch;
export const net = { raw: false, timeoutMs: 90000, calls: 0, retries: 0, errors: [], rewrite: true, log: [] };
const modelOf = (url) => url.match(/models\/([^:]+)/)?.[1];
const nextModel = (m) => {
  const start = Math.max(0, FALLBACK_CHAIN.indexOf(m));
  return [...FALLBACK_CHAIN.slice(start), ...FALLBACK_CHAIN].find((x) => !exhausted.has(x));
};
const record = (entry) => {
  net.log.push(entry);
  als.getStore()?.calls.push(entry);
};
globalThis.fetch = async (input, init = {}) => {
  let url = String(input);
  const isGemini = url.includes("generativelanguage.googleapis.com") && url.includes("/models/") && url.includes(":");
  if (!isGemini || (als.getStore()?.raw ?? net.raw)) {
    if (isGemini) {
      net.calls++;
      als.getStore()?.calls.push({ model: modelOf(url), raw: true });
    }
    return realFetch(input, init);
  }
  if (net.rewrite) url = url.replace(`/models/${CONFIGURED_MODEL}:`, `/models/${GEN_MODEL}:`);
  for (let attempt = 0; ; attempt++) {
    const m = modelOf(url);
    if (exhausted.has(m)) {
      const n = nextModel(m);
      if (!n) throw new Error("All fallback models have exhausted their daily free-tier quota");
      url = url.replace(`/models/${m}:`, `/models/${n}:`);
    }
    net.calls++;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(new Error(`harness timeout ${net.timeoutMs}ms`)), net.timeoutMs);
    const t0 = Date.now();
    try {
      const res = await realFetch(url, { ...init, signal: ctrl.signal });
      record({ model: modelOf(url), status: res.status, ms: Date.now() - t0 });
      if (res.status === 429 && attempt < 6) {
        const body = await res.clone().text();
        const wait = body.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/);
        const secs = wait ? (Number(wait[1] ?? 0) * 3600 + Number(wait[2] ?? 0) * 60 + Number(wait[3])) : 30;
        net.retries++;
        if (secs > 90 || /per_day|PerDay|free_tier_requests/i.test(body) && secs > 90) {
          exhausted.add(modelOf(url)); // daily quota gone → fall through the chain
          continue;
        }
        await new Promise((r) => setTimeout(r, (secs + 1) * 1000));
        continue;
      }
      if (res.status === 503 && attempt < 6) {
        net.retries++;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        // After two overloaded responses, move this call to the next model in the chain.
        if (attempt >= 1) {
          const cur = modelOf(url);
          const alt = FALLBACK_CHAIN.find((x) => x !== cur && !exhausted.has(x));
          if (alt) url = url.replace(`/models/${cur}:`, `/models/${alt}:`);
        }
        continue;
      }
      return res;
    } catch (e) {
      record({ model: modelOf(url), status: "ERR", ms: Date.now() - t0, err: String(e?.message ?? e) });
      if (attempt < 2) {
        net.retries++;
        continue;
      }
      throw e;
    }
  }
};
export { realFetch };
// Per-experiment 'as shipped' mode (no reroute/retry/timeout). Scoped with AsyncLocalStorage so
// concurrently running experiments are unaffected.
export const setRaw = (v) => {
  const s = als.getStore();
  if (s) s.raw = v;
  else net.raw = v;
};

// ───────── app modules ─────────
export async function makeCtx() {
  const [ai, clinical, transcribeMod, fmt, md, forms, csv, library, storage, crypto, assistant, db, reports, availability] = await Promise.all([
    load("lib/ai/client.ts"),
    load("lib/ai/clinical.ts"),
    load("lib/ai/transcribe.ts"),
    load("lib/format.ts"),
    load("lib/markdown.ts"),
    load("lib/forms.ts"),
    load("lib/csv.ts"),
    load("lib/library.ts"),
    load("lib/storage.ts"),
    load("lib/crypto.ts"),
    load("lib/ai/assistant.ts"),
    load("lib/db.ts"),
    load("lib/reports.ts"),
    load("lib/availability.ts"),
  ]);
  const base = await ai.resolveProvider("text");
  const prov = (model) => ({ ...base, model });
  const fixtures = await import("./fixtures/transcripts.mjs");

  // ── HTTP to the running dev server, signed in as the dev clinician (local test account) ──
  const { SignJWT } = appRequire("jose");
  const user = await db.db.user.findFirst({ where: { role: "ADMIN" } });
  const jwt = await new SignJWT({ sub: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h").sign(new TextEncoder().encode(process.env.APP_SECRET));
  const http = async (path, opts = {}) => {
    const { auth = true, timeoutMs = 60000, ...rest } = opts;
    const headers = { ...(rest.headers ?? {}), ...(auth ? { cookie: `solace_session=${typeof auth === "string" ? auth : jwt}` } : {}) };
    const t0 = Date.now();
    const res = await realFetch(BASE_URL + path, { redirect: "manual", ...rest, headers, signal: AbortSignal.timeout(timeoutMs) });
    const text = await res.text();
    return { status: res.status, text, headers: res.headers, ms: Date.now() - t0, location: res.headers.get("location") };
  };

  // ── LLM judge (different model from the generator) ──
  // Retries malformed judge JSON (a judge failure must not be scored as an app failure).
  const judge = async (task, payload) => {
    for (let i = 0; ; i++) {
      try {
        return await judgeOnce(task, payload);
      } catch (e) {
        if (i >= 2 || !/JSON/.test(e.message)) throw e;
      }
    }
  };
  const judgeOnce = async (task, payload) =>
    ai.chatJson(
      {
        system: "You are a strict clinical-documentation auditor. You compare generated text against source material and report precisely. Output JSON only.",
        messages: [{ role: "user", content: `${task}\n\n${payload}` }],
        maxTokens: 20000, // Gemini 3 counts thinking tokens against this; 4000 truncated the JSON
      },
      prov(JUDGE_MODEL),
    );

  // Faithfulness: list claims in the output not supported by the source; check forbidden assertions.
  const faithfulness = async (source, output, absent = []) => {
    const r = await judge(
      `Compare the OUTPUT to the SOURCE.
1. List every factual claim in OUTPUT that is NOT supported by SOURCE (ignore generic phrasing, section headings, and statements that something was "not discussed/not assessed").
2. Count the total number of distinct factual claims in OUTPUT.
3. For each item in FORBIDDEN, say whether OUTPUT asserts it as fact (true/false).
Return {"unsupported": ["..."], "totalClaims": <int>, "forbidden": [{"item": "...", "asserted": true|false, "evidence": "..."}]}`,
      `FORBIDDEN:\n${absent.map((a) => `- ${a}`).join("\n") || "(none)"}\n\nSOURCE:\n${source}\n\nOUTPUT:\n${output}`,
    );
    const total = Math.max(1, r.totalClaims ?? 1);
    const unsupported = r.unsupported ?? [];
    const forbiddenHits = (r.forbidden ?? []).filter((f) => f.asserted);
    return { unsupported, total, forbiddenHits, precision: Math.max(0, 1 - unsupported.length / total) };
  };

  const recall = (text, facts) => {
    const low = text.toLowerCase();
    const hits = facts.filter((f) => f.any.some((k) => low.includes(k.toLowerCase())));
    return { score: hits.length / facts.length, missing: facts.filter((f) => !hits.includes(f)).map((f) => f.id) };
  };

  const templates = await db.db.noteTemplate.findMany();
  const tpl = (name) => {
    const t = templates.find((x) => x.name === name);
    return { name: t.name, guidance: t.guidance, sections: t.sections, id: t.id, category: t.category };
  };
  const sourceOf = (f) => (f.utterances ? { transcript: clinical.transcriptToText(f.utterances, f.ctx) } : { text: f.text });
  const noteText = (sections) => clinical.sectionsToText(sections);

  return { ai, clinical, transcribeMod, fmt, md, forms, csv, library, storage, crypto, assistant, db: db.db, reports, availability, base, prov, fixtures, http, jwt, user, judge, faithfulness, recall, templates, tpl, sourceOf, noteText, net, HERE };
}
