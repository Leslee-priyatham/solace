import { readFileSync } from "node:fs";
import { makeCtx } from "./harness.mjs";
const ctx = await makeCtx();
const orig = globalThis.fetch;
globalThis.fetch = async (u, o) => { const r = await orig(u, o); const t = await r.clone().text(); try { const j = JSON.parse(t); const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? ""; console.log("RAW shape:", txt.trim().slice(0, 140).replace(/\s+/g, " ")); } catch {} return r; };
for (let i = 0; i < 4; i++) {
  const r = await ctx.transcribeMod.transcribe(readFileSync("../autoresearch/fixtures/dialogue.wav"), "audio/wav", "dialogue.wav");
  console.log(`run ${i}: ${r.utterances.length} utterances parsed`);
}
process.exit(0);
