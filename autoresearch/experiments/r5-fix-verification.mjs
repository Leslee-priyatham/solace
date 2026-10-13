// Round 5 — verifies the blocking-issue fixes. Most use a local mock Gemini server, so they are
// deterministic and cost no quota.
import http from "node:http";
import { setRaw } from "../harness.mjs";

export const round = 5;

/** Mock Gemini: `script` is a list of handlers, one per request (the last one repeats). */
async function mockGemini(script) {
  let n = 0;
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ url: req.url, body });
      const h = script[Math.min(n++, script.length - 1)];
      h(res, { url: req.url, body });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    base: `http://127.0.0.1:${server.address().port}/v1beta`,
    seen,
    close: () => (server.closeAllConnections?.(), server.close()),
  };
}
const json = (status, obj) => (res) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};
const sse = (text) => (res) => {
  res.writeHead(200, { "content-type": "text/event-stream" });
  res.end(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] })}\n\n`);
};
const QUOTA_429 = {
  error: {
    code: 429,
    message: "You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash\nPlease retry in 9h57m26.349202915s.",
    status: "RESOURCE_EXHAUSTED",
  },
};

export default [
  {
    id: "E101", area: "fix-verification",
    title: "Transient 503s are retried and the request then succeeds",
    hypothesis: "Two 503s followed by a good stream → chat() returns the text after 3 attempts.",
    run: async (ctx) => {
      const m = await mockGemini([json(503, { error: { code: 503, message: "overloaded" } }), json(503, { error: { code: 503, message: "overloaded" } }), sse("PONG")]);
      setRaw(true);
      try {
        const t0 = Date.now();
        const out = await ctx.ai.chat({ messages: [{ role: "user", content: "hi" }] }, { ...ctx.base, baseUrl: m.base, model: "mock" }).catch((e) => `ERR ${e.message}`);
        return { score: out === "PONG" && m.seen.length === 3 ? 1 : 0, notes: `result "${out.slice(0, 80)}" after ${m.seen.length} attempts in ${Date.now() - t0}ms` };
      } finally {
        setRaw(false);
        m.close();
      }
    },
  },
  {
    id: "E102", area: "fix-verification",
    title: "Daily-quota 429 fails fast (no pointless retries) with a human message",
    hypothesis: "One attempt; message says the quota is used up and when it resets; no raw JSON.",
    run: async (ctx) => {
      const m = await mockGemini([json(429, QUOTA_429)]);
      setRaw(true);
      try {
        const err = await ctx.ai.chat({ messages: [{ role: "user", content: "hi" }] }, { ...ctx.base, baseUrl: m.base, model: "mock" }).then(() => null, (e) => e.message);
        const checks = { failed: !!err, oneAttempt: m.seen.length === 1, human: /quota.*used up/i.test(err ?? ""), resetHint: /about 10 h/.test(err ?? ""), settingsLink: (err ?? "").includes("Settings → AI providers"), noJson: !/[{}]/.test(err ?? "") };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)} — "${err}"` };
      } finally {
        setRaw(false);
        m.close();
      }
    },
  },
  {
    id: "E103", area: "fix-verification",
    title: "Error messages for common provider failures are short and readable",
    hypothesis: "503, bad key, unknown model and timeouts all map to plain sentences without JSON.",
    run: async (ctx) => {
      const E = ctx.ai.AiRequestError;
      const cases = {
        overloaded: new E("Google Gemini", 503, JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand.", status: "UNAVAILABLE" } })),
        badKey: new E("Google Gemini", 400, JSON.stringify({ error: { code: 400, message: "API key not valid. Please pass a valid API key.", status: "INVALID_ARGUMENT" } })),
        noModel: new E("Google Gemini", 404, JSON.stringify({ error: { code: 404, message: "models/gemini-9 is not found", status: "NOT_FOUND" } })),
        timeout: new E("Google Gemini", "timeout", "No response after 60s."),
      };
      const res = Object.fromEntries(Object.entries(cases).map(([k, e]) => [k, { msg: e.message, ok: !/[{}]/.test(e.message) && e.message.length < 300 }]));
      const ok = Object.values(res).filter((r) => r.ok).length;
      return { score: ok / 4, notes: Object.entries(res).map(([k, r]) => `${k}: "${r.msg}"`).join(" | ") };
    },
  },
  {
    id: "E104", area: "fix-verification",
    title: "Gemini array-wrapped transcription JSON is no longer dropped",
    hypothesis: "A general Gemini model returning [{utterances:[…]}] yields all utterances.",
    run: async (ctx) => {
      const wrapped = [{ language: "en", utterances: [{ start: 0, end: 2, speaker: "A", text: "Hello." }, { start: 2, end: 4, speaker: "B", text: "Hi there." }] }];
      const bare = wrapped[0].utterances;
      const body = (obj) => json(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] });
      const m = await mockGemini([body(wrapped), body(bare), body(wrapped[0])]);
      setRaw(true);
      try {
        const prov = { ...ctx.base, baseUrl: m.base, model: "gemini-mock-flash" };
        const counts = [];
        for (let i = 0; i < 3; i++) counts.push((await ctx.transcribeMod.transcribe(Buffer.from("x"), "audio/wav", "a.wav", prov)).utterances.length);
        return { score: counts.every((c) => c === 2) ? 1 : 0, notes: `utterances parsed — array-wrapped: ${counts[0]}, bare list: ${counts[1]}, plain object: ${counts[2]}` };
      } finally {
        setRaw(false);
        m.close();
      }
    },
  },
  {
    id: "E105", area: "fix-verification",
    title: "Dedicated transcribe model: request uses audioTranscriptionConfig; turns/timestamps parsed",
    hypothesis: "For *-transcribe models the app sends diarization config (no JSON mode) and maps parts to speaker turns.",
    run: async (ctx) => {
      const reply = json(200, {
        candidates: [{ content: { parts: [
          { audioTranscription: { text: "Welcome back.", speakerLabel: "spk:0", words: [{ word: "Welcome", startOffset: "0.100s", endOffset: "0.500s" }, { word: "back.", startOffset: "0.500s", endOffset: "0.900s" }] } },
          { audioTranscription: { text: "Thanks.", speakerLabel: "spk:1", words: [{ word: "Thanks.", startOffset: "1.2s", endOffset: "1.6s" }] } },
        ] } }],
      });
      const m = await mockGemini([reply]);
      setRaw(true);
      try {
        const r = await ctx.transcribeMod.transcribe(Buffer.from("x"), "audio/wav", "a.wav", { ...ctx.base, baseUrl: m.base, model: "gemini-3.5-transcribe" });
        const sent = JSON.parse(m.seen[0].body);
        const checks = {
          usesConfig: sent.generationConfig?.audioTranscriptionConfig?.diarization === true,
          noJsonMode: !sent.generationConfig?.responseMimeType,
          noPrompt: !sent.contents[0].parts.some((p) => p.text),
          turns: r.utterances.length === 2 && r.diarized,
          speakers: r.utterances[0].speaker === "spk:0" && r.utterances[1].speaker === "spk:1",
          times: r.utterances[0].start === 0.1 && r.utterances[0].end === 0.9 && r.utterances[1].start === 1.2,
        };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: JSON.stringify(checks) };
      } finally {
        setRaw(false);
        m.close();
      }
    },
  },
  {
    id: "E106", area: "fix-verification",
    title: "Long recordings: if diarization is rejected, retry without it and still return text",
    hypothesis: "A 400 on the diarized request → second request without diarization → sentence-split transcript.",
    run: async (ctx) => {
      const m = await mockGemini([
        json(400, { error: { code: 400, message: "Audio longer than 30 minutes is not supported with diarization.", status: "INVALID_ARGUMENT" } }),
        json(200, { candidates: [{ content: { parts: [{ audioTranscription: { text: "First sentence here. Second one follows." } }] } }] }),
      ]);
      setRaw(true);
      try {
        const r = await ctx.transcribeMod.transcribe(Buffer.from("x"), "audio/wav", "a.wav", { ...ctx.base, baseUrl: m.base, model: "gemini-3.5-transcribe" });
        const second = JSON.parse(m.seen[1]?.body ?? "{}");
        const ok = m.seen.length === 2 && !second.generationConfig?.audioTranscriptionConfig?.diarization && r.utterances.length === 2 && !r.diarized;
        return { score: ok ? 1 : 0, notes: `${m.seen.length} requests; ${r.utterances.length} utterances; diarized=${r.diarized}` };
      } finally {
        setRaw(false);
        m.close();
      }
    },
  },
  {
    id: "E108", area: "fix-verification", serial: true, budget: 180000,
    title: "Silent recording through the real API ends as 'No speech detected', not a note",
    hypothesis: "E082 shows gemini-3.5-transcribe hears '5' in silence; the pipeline's minimum-words guard stops a note being written from it.",
    run: async (ctx) => {
      const { readFileSync } = await import("node:fs");
      const c = await ctx.db.client.findFirst({ where: { isDemo: true } });
      const fd = new FormData();
      fd.append("mode", "IN_PERSON");
      fd.append("clientId", c.id);
      fd.append("title", "[autoresearch] E108 silence");
      fd.append("audio", new File([readFileSync(new URL("../fixtures/silence.wav", import.meta.url))], "silence.wav", { type: "audio/wav" }));
      const { id } = JSON.parse((await ctx.http("/api/sessions", { method: "POST", body: fd })).text);
      let st;
      for (let i = 0; i < 60; i++) {
        st = JSON.parse((await ctx.http(`/api/sessions/${id}/status`)).text);
        if (["READY", "ERROR"].includes(st.status)) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      const row = await ctx.db.session.findUnique({ where: { id } });
      await ctx.db.session.delete({ where: { id } });
      await ctx.storage.deleteUpload(row.audioPath);
      const ok = st.status === "ERROR" && /no speech/i.test(row.error ?? "") && st.documents.length === 0;
      return { score: ok ? 1 : 0, notes: `${st.status}: ${row.error}; notes written: ${st.documents.length}` };
    },
  },
  {
    id: "E107", area: "fix-verification", serial: true, budget: 180000,
    title: "Interrupted sessions are resumed on startup without duplicating finished notes",
    hypothesis: "A session left GENERATING (one note done, one half-written) ends READY with one copy of each note.",
    run: async (ctx) => {
      const { load } = await import("../load.mjs");
      const sessions = await load("lib/sessions.ts");
      const client = await ctx.db.client.findFirst({ where: { isDemo: true } });
      const soap = ctx.templates.find((t) => t.name === "SOAP");
      const recap = ctx.templates.find((t) => t.name === "Session recap for client");
      const s = await ctx.db.session.create({
        data: { title: "[autoresearch] E107 interrupted", clientId: client.id, providerId: ctx.user.id, captureMode: "DICTATION", status: "GENERATING", rawText: ctx.fixtures.F4.text, durationSec: 2700 },
      });
      await ctx.db.client.update({ where: { id: client.id }, data: { notePrefs: { templateId: soap.id, clientNoteTemplateId: recap.id } } });
      await ctx.db.noteDocument.create({ data: { sessionId: s.id, clientId: client.id, templateId: soap.id, title: "SOAP", status: "DRAFT", sections: [{ id: "x", title: "Done before crash", html: "<p>kept</p>" }] } });
      await ctx.db.noteDocument.create({ data: { sessionId: s.id, clientId: client.id, templateId: recap.id, title: "Recap", status: "GENERATING" } });
      try {
        await sessions.resumeInterruptedSessions(new Date(Date.now() + 1000));
        const after = await ctx.db.session.findUnique({ where: { id: s.id }, include: { documents: true } });
        const soaps = after.documents.filter((d) => d.templateId === soap.id);
        const recaps = after.documents.filter((d) => d.templateId === recap.id);
        const checks = { ready: after.status === "READY", soapKept: soaps.length === 1 && soaps[0].sections[0]?.title === "Done before crash", recapRewritten: recaps.length === 1 && recaps[0].status === "DRAFT" };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; status ${after.status}${after.error ? ` (${after.error.slice(0, 120)})` : ""}` };
      } finally {
        await ctx.db.client.update({ where: { id: client.id }, data: { notePrefs: client.notePrefs ?? {} } });
        await ctx.db.noteDocument.deleteMany({ where: { sessionId: s.id } });
        await ctx.db.session.delete({ where: { id: s.id } });
      }
    },
  },
];
