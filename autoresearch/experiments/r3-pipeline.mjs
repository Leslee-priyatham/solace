// Round 3 — transcription (real audio), the end-to-end capture pipeline through the running dev server,
// and the Assistant. Pipeline/assistant experiments temporarily point the app's AI settings at a
// working model and always restore the original assignment.
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONFIGURED_TRANSCRIBE_MODEL as CONFIGURED_MODEL, GEN_MODEL, net, setRaw } from "../harness.mjs";
import { HERE } from "../load.mjs";

export const round = 3;

const audio = () => readFileSync(path.join(HERE, "fixtures", "dialogue.wav"));
const truth = () => JSON.parse(readFileSync(path.join(HERE, "fixtures", "dialogue.json"), "utf8").replace(/^﻿/, ""));
const words = (s) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = words(ref), h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}

// Temporarily assign a model to a purpose in the app's settings (the dev server reads it per request).
async function withModel(ctx, purposes, model, fn) {
  const saved = {};
  for (const p of purposes) {
    const s = await ctx.db.setting.findUnique({ where: { key: `ai.${p}` } });
    saved[p] = s.value;
    await ctx.db.setting.update({ where: { key: `ai.${p}` }, data: { value: { ...s.value, model } } });
  }
  try {
    return await fn();
  } finally {
    for (const p of purposes) await ctx.db.setting.update({ where: { key: `ai.${p}` }, data: { value: saved[p] } });
  }
}

async function createSession(ctx, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await ctx.http("/api/sessions", { method: "POST", body: fd, timeoutMs: 60000 });
  return { status: r.status, body: r.text, id: r.status === 200 ? JSON.parse(r.text).id : null };
}
async function waitFor(ctx, id, ms = 150000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    const r = await ctx.http(`/api/sessions/${id}/status`);
    last = JSON.parse(r.text);
    if (["READY", "ERROR"].includes(last.status)) return { ...last, ms: Date.now() - t0 };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ...last, ms: Date.now() - t0, timedOut: true };
}
const demoClient = (ctx) => ctx.db.client.findFirst({ where: { isDemo: true } });

async function ask(ctx, body) {
  const r = await ctx.http("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), timeoutMs: 120000 });
  return { status: r.status, text: r.text, conversationId: r.headers.get("x-conversation-id"), ms: r.ms };
}

export default [
  // ───────── transcription ─────────
  {
    id: "E076", area: "transcription",
    title: `Transcribe real audio with the configured transcription model (${CONFIGURED_MODEL}), as shipped`,
    hypothesis: "The configured model can transcribe right now; if not, the error is understandable.",
    run: async (ctx) => {
      setRaw(true);
      try {
        const r = await Promise.race([ctx.transcribeMod.transcribe(audio(), "audio/wav", "dialogue.wav"), new Promise((_, rej) => setTimeout(() => rej(new Error("no response in 60s")), 60000))]);
        return { score: r.utterances.length ? 1 : 0, notes: `${r.utterances.length} utterances` };
      } catch (e) {
        const raw = /\{\s*"error"/.test(e.message);
        return { score: 0, notes: `fails: ${e.message.replace(/\s+/g, " ").slice(0, 220)}${raw ? " (raw provider JSON shown to user)" : ""}` };
      } finally {
        setRaw(false);
      }
    },
  },
  {
    id: "E077", area: "transcription", budget: 180000,
    title: "Transcription accuracy on a 47s two-voice recording (word error rate)",
    hypothesis: "Gemini transcribes clear speech with WER under 10%.",
    run: async (ctx) => {
      const r = await ctx.transcribeMod.transcribe(audio(), "audio/wav", "dialogue.wav");
      const ref = truth().map((t) => t.text).join(" ");
      const hyp = r.utterances.map((u) => u.text).join(" ");
      const w = wer(ref, hyp);
      return { score: Math.max(0, 1 - w * 2), notes: `WER ${(w * 100).toFixed(1)}%; ${r.utterances.length} utterances; language ${r.language}`, data: r };
    },
  },
  {
    id: "E078", area: "transcription", budget: 180000,
    title: "Transcription separates the two speakers (diarization)",
    hypothesis: "Two distinct speaker labels, and turn boundaries line up with the script.",
    run: async (ctx) => {
      const r = await ctx.transcribeMod.transcribe(audio(), "audio/wav", "dialogue.wav");
      const labels = [...new Set(r.utterances.map((u) => u.speaker))];
      const t = truth();
      // Align utterance i to the script line with the most word overlap, then check speaker consistency.
      const map = {};
      let consistent = 0;
      for (const u of r.utterances) {
        const best = t.map((x, i) => ({ i, o: words(x.text).filter((w) => words(u.text).includes(w)).length })).sort((a, b) => b.o - a.o)[0];
        const role = t[best.i].speaker;
        map[u.speaker] ??= role;
        if (map[u.speaker] === role) consistent++;
      }
      const score = (labels.length === 2 ? 0.5 : 0) + 0.5 * (consistent / Math.max(1, r.utterances.length));
      return { score, notes: `${labels.length} labels (${labels.join(",")}); ${consistent}/${r.utterances.length} utterances consistent with true speaker` };
    },
  },
  {
    id: "E079", area: "transcription", budget: 180000,
    title: "Transcript timestamps are monotonic and inside the recording",
    hypothesis: "start/end seconds are usable for audio sync and talk-time analytics.",
    run: async (ctx) => {
      const buf = audio();
      const dur = (buf.length - 44) / 32000;
      const r = await ctx.transcribeMod.transcribe(buf, "audio/wav", "dialogue.wav");
      const u = r.utterances;
      const checks = {
        numeric: u.every((x) => typeof x.start === "number" && typeof x.end === "number"),
        ordered: u.every((x, i) => i === 0 || x.start >= u[i - 1].start),
        positive: u.every((x) => x.end >= x.start),
        inside: u.every((x) => x.end <= dur + 2),
        coverage: (u.at(-1)?.end ?? 0) >= dur * 0.7,
      };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; audio ${dur.toFixed(1)}s, last end ${u.at(-1)?.end}` };
    },
  },
  {
    id: "E080", area: "transcription", budget: 180000,
    title: "Audio → transcript → clinician/client roles, end to end",
    hypothesis: "After labelSpeakers, the therapist (Zira) is PROVIDER and the client (David) is CLIENT.",
    run: async (ctx) => {
      const r = await ctx.transcribeMod.transcribe(audio(), "audio/wav", "dialogue.wav");
      const labeled = await ctx.clinical.labelSpeakers(r.utterances, r.diarized, {});
      const t = truth();
      let ok = 0;
      for (const u of labeled) {
        const best = t.map((x) => ({ x, o: words(x.text).filter((w) => words(u.text).includes(w)).length })).sort((a, b) => b.o - a.o)[0].x;
        if (best.speaker === u.speaker) ok++;
      }
      return { score: ok / Math.max(1, labeled.length), notes: `${ok}/${labeled.length} turns have the right role` };
    },
  },
  {
    id: "E081", area: "transcription",
    title: "Recordings over 18 MB are rejected with a clear message before any upload",
    hypothesis: "Gemini inline-audio size limit is enforced locally.",
    run: async (ctx) => {
      const before = net.calls;
      try {
        await ctx.transcribeMod.transcribe(Buffer.alloc(19 * 1024 * 1024), "audio/webm", "big.webm");
        return { score: 0, notes: "accepted a 19 MB buffer" };
      } catch (e) {
        const clean = /18 MB/.test(e.message) && net.calls === before;
        return { score: clean ? 1 : 0.5, notes: `${e.message.slice(0, 160)}; API calls made: ${net.calls - before}` };
      }
    },
  },
  {
    id: "E082", area: "transcription", budget: 150000,
    title: "Silent recording yields no invented speech",
    hypothesis: "3s of silence transcribes to zero utterances (the pipeline then says 'No speech was detected').",
    run: async (ctx) => {
      const r = await ctx.transcribeMod.transcribe(readFileSync(path.join(HERE, "fixtures", "silence.wav")), "audio/wav", "silence.wav");
      const text = r.utterances.map((u) => u.text).join(" ").trim();
      return { score: r.utterances.length === 0 || !text ? 1 : 0, notes: r.utterances.length ? `invented: "${text.slice(0, 160)}"` : "0 utterances (correct)" };
    },
  },
  {
    id: "E083", area: "transcription",
    title: "Gemini transcription with a blank model falls back to a model this key can use",
    hypothesis: "The code's fallback 'gemini-2.5-flash' returned 404 for this key in E003, so a blank model breaks transcription.",
    run: async (ctx) => {
      setRaw(true);
      try {
        await ctx.transcribeMod.transcribe(audio(), "audio/wav", "dialogue.wav", { ...ctx.base, model: "" });
        return { score: 1, notes: "fallback model worked" };
      } catch (e) {
        return { score: 0, notes: `blank model → ${e.message.replace(/\s+/g, " ").slice(0, 200)}` };
      } finally {
        setRaw(false);
      }
    },
  },
  // ───────── end-to-end pipeline through the running app ─────────
  {
    id: "E084", area: "pipeline", serial: true, budget: 200000,
    title: "Write-mode session with the app's CURRENT settings: what the clinician sees",
    hypothesis: "With the configured model over quota/overloaded, the session fails fast with a readable error (not stuck 'Generating').",
    run: async (ctx) => {
      const c = await demoClient(ctx);
      const s = await createSession(ctx, { mode: "DICTATION", clientId: c.id, title: "[autoresearch] E084", text: ctx.fixtures.F4.text, durationSec: "2700" });
      if (!s.id) return { score: 0, notes: `create failed ${s.status} ${s.body.slice(0, 120)}` };
      const st = await waitFor(ctx, s.id, 120000);
      const row = await ctx.db.session.findUnique({ where: { id: s.id } });
      if (st.timedOut) return { score: 0, notes: `still ${st.status} after ${st.ms / 1000}s — the clinician sees an endless spinner` };
      const rawJson = /\{\s*"error"/.test(row.error ?? "");
      const score = st.status === "READY" ? 1 : rawJson ? 0.4 : 0.8;
      return { score, notes: `${st.status} after ${(st.ms / 1000).toFixed(0)}s; error shown: ${(row.error ?? "").replace(/\s+/g, " ").slice(0, 200)}` };
    },
  },
  {
    id: "E085", area: "pipeline", serial: true, budget: 240000,
    title: `Write-mode session end to end with a working model (${GEN_MODEL})`,
    hypothesis: "Dictation → title, synopsis and a DRAFT note with every section filled, via the real API.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const s = await createSession(ctx, { mode: "DICTATION", clientId: c.id, title: "", text: ctx.fixtures.F4.text, durationSec: "2700" });
        const st = await waitFor(ctx, s.id);
        const row = await ctx.db.session.findUnique({ where: { id: s.id }, include: { documents: true } });
        await ctx.db.session.update({ where: { id: s.id }, data: { title: `[autoresearch] ${row.title ?? ""}` } });
        const doc = row.documents[0];
        const secs = doc?.sections ?? [];
        const filled = secs.filter((x) => ctx.fmt.stripHtml(x.html).length > 10 && x.html !== "<p>Not documented.</p>").length;
        const checks = { ready: st.status === "READY", title: !!row.title, synopsis: !!row.synopsis, draft: doc?.status === "DRAFT", filled: secs.length > 0 && filled === secs.length };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${st.status} in ${(st.ms / 1000).toFixed(0)}s; ${JSON.stringify(checks)}; title "${row.title}"; template ${doc?.title}; ${filled}/${secs.length} sections${row.error ? `; error ${row.error.slice(0, 120)}` : ""}` };
      }),
  },
  {
    id: "E086", area: "pipeline", serial: true, budget: 300000,
    title: "Upload a recording end to end: transcript, speakers, talk-time analytics, chapters, note",
    hypothesis: "The full audio pipeline works through the real API once a usable model is configured.",
    run: async (ctx) =>
      withModel(ctx, ["text", "transcription"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const s = await createSession(ctx, { mode: "IN_PERSON", clientId: c.id, title: "[autoresearch] E086 audio", audio: new File([audio()], "dialogue.wav", { type: "audio/wav" }), durationSec: "47" });
        if (!s.id) return { score: 0, notes: `create failed ${s.status} ${s.body.slice(0, 160)}` };
        const st = await waitFor(ctx, s.id, 240000);
        const row = await ctx.db.session.findUnique({ where: { id: s.id }, include: { documents: true } });
        const a = row.analytics ?? {};
        const checks = {
          ready: st.status === "READY",
          transcript: (row.transcript ?? []).length >= 4,
          bothRoles: new Set((row.transcript ?? []).map((u) => u.speaker)).size >= 2,
          analytics: a.providerSec > 0 && a.clientSec > 0,
          chapters: (row.chapters ?? []).length >= 1,
          note: row.documents.some((d) => d.status === "DRAFT"),
        };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${st.status} in ${(st.ms / 1000).toFixed(0)}s; ${JSON.stringify(checks)}; talk-time P${a.providerSec}s/C${a.clientSec}s${row.error ? `; error ${row.error.slice(0, 160)}` : ""}` };
      }),
  },
  {
    id: "E087", area: "pipeline",
    title: "Session API validation: empty submission → 400, reused appointment → 409",
    hypothesis: "Bad requests are rejected with clear messages.",
    run: async (ctx) => {
      const empty = await createSession(ctx, { mode: "DICTATION", text: "   " });
      const appt = await ctx.db.appointment.findFirst();
      let dup = { status: "skipped" };
      const used = appt && (await ctx.db.session.findUnique({ where: { appointmentId: appt.id } }));
      if (used) dup = await createSession(ctx, { mode: "DICTATION", text: "x", appointmentId: appt.id });
      const checks = { empty400: empty.status === 400, dup409: dup.status === 409 || dup.status === "skipped" };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `empty→${empty.status} ${empty.body.slice(0, 80)}; reused appointment→${dup.status}${used ? "" : " (no linked appointment to test)"}` };
    },
  },
  {
    id: "E088", area: "pipeline",
    title: "Session status endpoint: known id returns status+documents, unknown id 404",
    hypothesis: "The polling endpoint the session page relies on behaves.",
    run: async (ctx) => {
      const s = await ctx.db.session.findFirst({ where: { isDemo: undefined } });
      const ok = await ctx.http(`/api/sessions/${s.id}/status`);
      const nf = await ctx.http(`/api/sessions/nope/status`);
      const j = JSON.parse(ok.text);
      const pass = ok.status === 200 && j.status && Array.isArray(j.documents) && nf.status === 404;
      return { score: pass ? 1 : 0, notes: `known→${ok.status} ${ok.text.slice(0, 100)}; unknown→${nf.status}` };
    },
  },
  // ───────── assistant ─────────
  {
    id: "E089", area: "assistant", serial: true, budget: 150000,
    title: "Assistant 'My day' quick action streams a grounded practice overview",
    hypothesis: "It mentions the unsigned SOAP note and the demo client from the practice snapshot.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const r = await ask(ctx, { action: "today" });
        const checks = { ok: r.status === 200, conv: !!r.conversationId, unsigned: /unsigned|SOAP|draft/i.test(r.text), noError: !/request failed/i.test(r.text) };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; ${(r.ms / 1000).toFixed(1)}s; "${r.text.replace(/\s+/g, " ").slice(0, 200)}"` };
      }),
  },
  {
    id: "E090", area: "assistant", serial: true, budget: 180000,
    title: "Assistant 'Session prep' for the demo client uses the treatment plan and measures",
    hypothesis: "It cites real plan objectives (Sunday-evening anxiety, thought records, 7h sleep) and GAD-7 trend.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const r = await ask(ctx, { action: "session_prep", clientId: c.id });
        const hits = { sundayAnxiety: /sunday/i.test(r.text), thoughtRecords: /thought record/i.test(r.text), sleep: /sleep/i.test(r.text), gad7: /GAD-?7/i.test(r.text) };
        const v = Object.values(hits);
        return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(hits)}; ${r.text.length} chars in ${(r.ms / 1000).toFixed(1)}s` };
      }),
  },
  {
    id: "E091", area: "assistant", serial: true, budget: 150000,
    title: "Assistant admits when the record lacks an answer",
    hypothesis: "Asked for a 2019 PHQ-9 score that doesn't exist, it says so instead of inventing one.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const r = await ask(ctx, { message: "What was this client's PHQ-9 score in March 2019, and what medication were they on then?", clientId: c.id });
        const admits = /(no|not|isn't|doesn't|does not|don't).{0,40}(record|document|available|information|data)|not (in|within) the record/i.test(r.text);
        const invented = /2019[^.]{0,60}\b(score|scored)\b[^.]{0,20}\b\d{1,2}\b/i.test(r.text) || /\b(sertraline|fluoxetine|escitalopram|bupropion)\b/i.test(r.text);
        return { score: admits && !invented ? 1 : invented ? 0 : 0.5, notes: `admits=${admits} invented=${invented}: "${r.text.replace(/\s+/g, " ").slice(0, 220)}"` };
      }),
  },
  {
    id: "E092", area: "assistant", serial: true, budget: 200000,
    title: "Assistant memory: 'Remember that …' is stored and used in a new conversation",
    hypothesis: "Memories persist and change later answers.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const marker = "I sign my notes as 'Dr. Q. Example, PsyD'";
        await ask(ctx, { message: `Remember that ${marker}.` });
        const mem = await ctx.db.assistantMemory.findFirst({ where: { content: { contains: "Q. Example" } } });
        const r = await ask(ctx, { message: "How do I sign my notes? Answer in one line." });
        if (mem) await ctx.db.assistantMemory.delete({ where: { id: mem.id } });
        const checks = { stored: !!mem, used: /Q\. Example/.test(r.text) };
        const v = Object.values(checks);
        return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; reply "${r.text.replace(/\s+/g, " ").slice(0, 140)}"` };
      }),
  },
  {
    id: "E093", area: "assistant", serial: true, budget: 200000,
    title: "Assistant multi-turn: follow-up question keeps context",
    hypothesis: "History is sent each turn so 'the second one' resolves correctly.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const a = await ask(ctx, { message: "List this client's treatment plan areas as a numbered list, titles only.", clientId: c.id });
        const b = await ask(ctx, { conversationId: a.conversationId, message: "For the second one, what are its objectives?", clientId: c.id });
        const ok = /7 hours|sleep/i.test(b.text) && !/thought records per week/i.test(b.text);
        return { score: ok ? 1 : /sleep/i.test(b.text) ? 0.5 : 0, notes: `turn1 "${a.text.replace(/\s+/g, " ").slice(0, 80)}" → turn2 "${b.text.replace(/\s+/g, " ").slice(0, 160)}"` };
      }),
  },
  {
    id: "E094", area: "assistant", serial: true, budget: 150000,
    title: "Assistant conversation gets an AI-generated title",
    hypothesis: "After the first exchange the title becomes a 3–6 word summary (maxTokens 30).",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const msg = "Can you help me think through how to explain exposure therapy to a client who is scared of it, in plain language?";
        const r = await ask(ctx, { message: msg });
        await new Promise((res) => setTimeout(res, 8000));
        const conv = await ctx.db.aiConversation.findUnique({ where: { id: r.conversationId } });
        const changed = conv.title !== msg.slice(0, 60);
        const n = conv.title.split(/\s+/).length;
        return { score: changed && n >= 2 && n <= 8 ? 1 : changed ? 0.5 : 0, notes: `title "${conv.title}"` };
      }),
  },
  {
    id: "E095", area: "security", serial: true, budget: 180000,
    title: "Stored XSS via assistant: client-authored text → model reply → markdownToHtml",
    hypothesis: "A link with a quote in it, planted in a chart note, survives into the rendered assistant HTML as an event handler.",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const c = await demoClient(ctx);
        const payload = "[Resource sheet](https://example.test/x'onmouseover='alert(document.cookie)'y=')";
        const note = await ctx.db.chartNote.create({ data: { clientId: c.id, authorId: ctx.user.id, title: "[autoresearch] resources", html: `<p>Client shared this link: ${payload}</p>`, date: new Date() } }).catch((e) => ({ err: e.message }));
        if (note.err) return { score: 0.5, status: "partial", notes: `could not plant chart note: ${note.err.slice(0, 120)}` };
        try {
          const r = await ask(ctx, { message: "Repeat any links from the chart notes exactly as written, as markdown links.", clientId: c.id });
          const html = ctx.md.markdownToHtml(r.text);
          const injected = /'\s*onmouseover=/i.test(html);
          return { score: injected ? 0 : 1, notes: injected ? `rendered HTML contains an event handler: ${html.match(/<a[^>]+>/)?.[0]?.slice(0, 160)}` : `not exploitable in this run; reply: ${r.text.slice(0, 120)}` };
        } finally {
          await ctx.db.chartNote.delete({ where: { id: note.id } });
        }
      }),
  },
  {
    id: "E096", area: "assistant",
    title: "Assistant handles a non-existent client id without crashing",
    hypothesis: "Unknown context degrades gracefully (200 + a reply or a clear message).",
    run: async (ctx) =>
      withModel(ctx, ["text"], GEN_MODEL, async () => {
        const r = await ask(ctx, { message: "Summarise this client.", clientId: "does-not-exist" });
        return { score: r.status === 200 ? 1 : r.status < 500 ? 0.5 : 0, notes: `${r.status}: ${r.text.replace(/\s+/g, " ").slice(0, 160)}` };
      }),
    serial: true,
  },
  {
    id: "E097", area: "assistant", serial: true, budget: 120000,
    title: "Assistant error UX with the configured model (as shipped)",
    hypothesis: "When the model is down/over quota, the chat shows a short human message, not raw provider JSON.",
    run: async (ctx) => {
      const r = await ask(ctx, { message: "hello" });
      const rawJson = /\{\s*"error"/.test(r.text);
      const failed = /request failed/i.test(r.text);
      return { score: !failed ? 1 : rawJson ? 0.2 : 0.8, notes: `${r.status} in ${(r.ms / 1000).toFixed(1)}s: "${r.text.replace(/\s+/g, " ").slice(0, 220)}"` };
    },
  },
];
