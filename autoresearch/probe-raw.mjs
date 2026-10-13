// Direct Gemini calls (no app code) to separate API behaviour from app behaviour.
import { load } from "./load.mjs";
const ai = await load("lib/ai/client.ts");
const p = await ai.resolveProvider("text");
const model = process.argv[2] || p.model;
const stream = process.argv[3] === "stream";
const maxTokens = Number(process.argv[4] || 0);
const url = `${p.baseUrl}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
const body = {
  contents: [{ role: "user", parts: [{ text: "Reply with exactly: PONG" }] }],
  generationConfig: maxTokens ? { maxOutputTokens: maxTokens } : {},
};
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 45000);
const t0 = Date.now();
try {
  const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": p.apiKey }, body: JSON.stringify(body) });
  console.log(model, stream ? "stream" : "unary", "max", maxTokens, "→ HTTP", res.status, "headers ms", Date.now() - t0);
  const text = await res.text();
  console.log("body ms", Date.now() - t0, text.slice(0, 600).replace(/\s+/g, " "));
} catch (e) {
  console.log(model, "ERR after", Date.now() - t0, "ms:", e.name, e.message);
}
process.exit(0);
