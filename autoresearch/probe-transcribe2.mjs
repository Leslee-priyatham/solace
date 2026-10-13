import { readFileSync } from "node:fs";
import { load } from "./load.mjs";
const ai = await load("lib/ai/client.ts");
const p = await ai.resolveProvider("text");
const audio = readFileSync(new URL(process.env.WAV || "./fixtures/dialogue.wav", import.meta.url));
const t0 = Date.now();
const res = await fetch(`${p.baseUrl}/models/gemini-3.5-transcribe:generateContent`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": p.apiKey },
  body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "audio/wav", data: audio.toString("base64") } }] }],
    generationConfig: { audioTranscriptionConfig: { languageCodes: [], diarization: true, wordTimestamp: true, mode: "VERBATIM" } } }),
});
const body = await res.json();
console.log(res.status, Date.now() - t0, "ms");
const parts = body.candidates?.[0]?.content?.parts ?? [];
console.log("parts:", parts.length, "keys:", JSON.stringify(parts.map((x) => Object.keys(x.audioTranscription ?? x))));
for (const x of parts) { const a = x.audioTranscription ?? {}; console.log(a.speakerLabel, a.words?.length, "words", JSON.stringify(a.words?.slice(0, 2)), (a.text ?? "").slice(0, 60)); }
console.log("RAW", JSON.stringify(body).slice(0, 900)); if (!parts.length) console.log(JSON.stringify(body).slice(0, 800));
process.exit(0);
