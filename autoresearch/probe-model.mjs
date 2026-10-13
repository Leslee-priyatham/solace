import { load } from "./load.mjs";
const ai = await load("lib/ai/client.ts");
const p = await ai.resolveProvider("text");
for (const m of process.argv.slice(2)) {
  const r = await fetch(`${p.baseUrl}/models/${m}`, { headers: { "x-goog-api-key": p.apiKey } });
  console.log(m, r.status, (await r.text()).replace(/\s+/g, " ").slice(0, 900));
}
process.exit(0);
