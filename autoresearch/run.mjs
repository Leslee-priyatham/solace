// Runner. Usage: node run.mjs [--round N] [--only E001,E002] [--rerun] [--concurrency 3]
// Like autoresearch: each experiment gets a fixed time budget, produces one score, and is appended to
// results.tsv whatever happens (pass / partial / fail / crash). Full evidence goes to runs/<id>.json.
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { makeCtx, net, als, GEN_MODEL, exhausted } from "./harness.mjs";
import { HERE } from "./load.mjs";

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ROUND = opt("--round");
const ONLY = opt("--only")?.split(",");
const RERUN = args.includes("--rerun");
const CONC = Number(opt("--concurrency", 3));
const BUDGET = Number(opt("--budget", 120000));

const TSV = path.join(HERE, "results.tsv");
const HEADER = ["id", "round", "area", "status", "score", "seconds", "api_calls", "served_by", "title", "notes"].join("\t");
if (!existsSync(TSV)) writeFileSync(TSV, HEADER + "\n");
const done = new Set(readFileSync(TSV, "utf8").split("\n").slice(1).map((l) => l.split("\t")[0]).filter(Boolean));

const all = [];
for (const f of readdirSync(path.join(HERE, "experiments")).filter((f) => f.endsWith(".mjs")).sort()) {
  const mod = await import(`./experiments/${f}`);
  for (const e of mod.default) all.push({ round: mod.round, ...e });
}
let queue = all.filter((e) => (ONLY ? ONLY.includes(e.id) : true) && (ROUND ? String(e.round) === ROUND : true) && (RERUN || ONLY || !done.has(e.id)));
console.log(`${queue.length} experiment(s) queued; gen model ${GEN_MODEL}`);

const ctx = await makeCtx();
const clean = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").slice(0, 400);
const statusOf = (score) => (score >= 0.8 ? "pass" : score >= 0.4 ? "partial" : "fail");

async function runOne(e) {
  return als.run({ id: e.id, calls: [] }, () => runOneInner(e));
}

async function runOneInner(e) {
  const t0 = Date.now();
  const store = als.getStore();
  let rec;
  try {
    const out = await Promise.race([
      e.run(ctx),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`exceeded ${e.budget ?? BUDGET}ms budget`)), e.budget ?? BUDGET)),
    ]);
    rec = { status: out.status ?? statusOf(out.score), score: out.score, notes: out.notes, data: out.data };
  } catch (err) {
    rec = { status: "crash", score: 0, notes: `CRASH: ${err?.message ?? err}`, data: { stack: err?.stack } };
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const served = [...new Set(store.calls.filter((c) => c.status === 200 || c.raw).map((c) => c.model))].join("+") || "-";
  const row = [e.id, e.round, e.area, rec.status, Number(rec.score ?? 0).toFixed(3), secs, store.calls.length, served, clean(e.title), clean(rec.notes)];
  if (RERUN || ONLY) {
    const kept = readFileSync(TSV, "utf8").split("\n").filter((l) => l && l.split("\t")[0] !== e.id);
    writeFileSync(TSV, kept.join("\n") + "\n");
  }
  appendFileSync(TSV, row.join("\t") + "\n");
  writeFileSync(path.join(HERE, "runs", `${e.id}.json`), JSON.stringify({ id: e.id, title: e.title, hypothesis: e.hypothesis, ...rec, seconds: Number(secs), calls: store.calls }, null, 2));
  console.log(`${e.id} ${rec.status.padEnd(7)} ${Number(rec.score ?? 0).toFixed(2)} ${secs.padStart(6)}s  ${e.title} — ${clean(rec.notes).slice(0, 160)}`);
}

// Experiments flagged `serial` (they change shared state such as the AI setting) run alone.
const serial = queue.filter((e) => e.serial);
const parallel = queue.filter((e) => !e.serial);
const workers = Array.from({ length: CONC }, async () => {
  while (parallel.length) await runOne(parallel.shift());
});
await Promise.all(workers);
for (const e of serial) await runOne(e);
console.log(`done. api calls ${net.calls}, harness retries ${net.retries}, models out of daily quota: ${[...exhausted].join(", ") || "none"}`);
process.exit(0);
