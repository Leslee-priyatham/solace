// Regenerates results.tsv from runs/<id>.json + experiment definitions (source of truth), sorted by id.
// Needed because two runner processes may append concurrently. Also writes results.json for the report.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const defs = {};
for (const f of readdirSync(path.join(HERE, "experiments")).filter((f) => f.endsWith(".mjs")).sort()) {
  const src = readFileSync(path.join(HERE, "experiments", f), "utf8");
  const round = Number(src.match(/export const round = (\d+)/)?.[1]);
  // Light static parse so this script doesn't need to load app modules.
  for (const m of src.matchAll(/id: "(E\d{3})", area: "([^"]+)"/g)) defs[m[1]] = { round, area: m[2] };
  for (const m of src.matchAll(/templateExperiment\("(E\d{3})"/g)) defs[m[1]] = { round, area: "note-templates" };
}
const clean = (s) => String(s ?? "").replace(/[\t\r\n]+/g, " ").slice(0, 400);
const rows = [];
for (const id of Object.keys(defs).sort()) {
  const f = path.join(HERE, "runs", `${id}.json`);
  if (!existsSync(f)) continue;
  const r = JSON.parse(readFileSync(f, "utf8"));
  const calls = r.calls ?? [];
  const served = [...new Set(calls.filter((c) => c.status === 200 || c.raw).map((c) => c.model))].join("+") || "-";
  rows.push({ id, round: defs[id].round, area: defs[id].area, status: r.status, score: Number(r.score ?? 0), seconds: r.seconds, api_calls: calls.length, served_by: served, title: r.title, notes: clean(r.notes), hypothesis: r.hypothesis });
}
const cols = ["id", "round", "area", "status", "score", "seconds", "api_calls", "served_by", "title", "notes"];
writeFileSync(path.join(HERE, "results.tsv"), [cols.join("\t"), ...rows.map((r) => cols.map((c) => (c === "score" ? r.score.toFixed(3) : clean(r[c]))).join("\t"))].join("\n") + "\n");
writeFileSync(path.join(HERE, "results.json"), JSON.stringify(rows, null, 2));
const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});
console.log(`${rows.length} experiments; status ${JSON.stringify(by("status"))}; mean score ${(rows.reduce((n, r) => n + r.score, 0) / rows.length).toFixed(3)}`);
