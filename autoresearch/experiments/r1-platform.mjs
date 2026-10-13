// Round 1 — baseline: AI availability, error handling, deterministic logic, routes, security.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { CONFIGURED_MODEL, GEN_MODEL, net, realFetch, setRaw } from "../harness.mjs";
import { APP, appRequire } from "../load.mjs";

export const round = 1;

const ping = async (ctx, model, n) => {
  const out = [];
  
  try {
    await Promise.all(
      Array.from({ length: n }, async () => {
        const t0 = Date.now();
        const ctrl = AbortSignal.timeout(45000);
        try {
          const r = await realFetch(`${ctx.base.baseUrl}/models/${model}:generateContent`, {
            method: "POST",
            signal: ctrl,
            headers: { "Content-Type": "application/json", "x-goog-api-key": ctx.base.apiKey },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with: OK" }] }] }),
          });
          await r.text();
          out.push({ status: r.status, ms: Date.now() - t0 });
        } catch (e) {
          out.push({ status: e.name === "TimeoutError" ? "hang>45s" : "ERR", ms: Date.now() - t0 });
        }
      }),
    );
  } finally {
  }
  const ok = out.filter((o) => o.status === 200).length;
  return { ok, n, out };
};
const summarise = (out) => Object.entries(out.reduce((m, o) => ((m[o.status] = (m[o.status] ?? 0) + 1), m), {})).map(([k, v]) => `${k}×${v}`).join(" ");

const sweep = async (ctx, paths) => {
  const res = [];
  for (const p of paths) {
    try {
      const r = await ctx.http(p, { timeoutMs: 120000 });
      const broken = r.status >= 500 || /Unhandled Runtime Error|Internal Server Error|Application error/i.test(r.text);
      res.push({ p, status: r.status, ms: r.ms, ok: (r.status === 200 || r.status === 307) && !broken, redirect: r.location });
    } catch (e) {
      res.push({ p, status: "ERR", ok: false, err: e.message });
    }
  }
  const bad = res.filter((r) => !r.ok);
  return { score: (res.length - bad.length) / res.length, notes: `${res.length - bad.length}/${res.length} OK${bad.length ? `; broken: ${bad.map((b) => `${b.p}→${b.status}`).join(", ")}` : ""}; slowest ${Math.max(...res.map((r) => r.ms ?? 0))}ms`, data: res };
};

const ids = async (ctx) => {
  const client = await ctx.db.client.findFirst({ where: { isDemo: true } });
  const session = await ctx.db.session.findFirst({ where: { clientId: client.id }, orderBy: { startedAt: "asc" } });
  const form = await ctx.db.form.findFirst();
  const template = await ctx.db.noteTemplate.findFirst();
  return { client, session, form, template };
};

export default [
  {
    id: "E001", area: "ai-availability", budget: 60000,
    title: `Configured model ${CONFIGURED_MODEL} answers (5 parallel calls)`,
    hypothesis: "The model the app is set to use is available right now.",
    run: async (ctx) => {
      const r = await ping(ctx, CONFIGURED_MODEL, 5);
      return { score: r.ok / r.n, notes: `${r.ok}/${r.n} succeeded: ${summarise(r.out)}`, data: r.out };
    },
  },
  {
    id: "E002", area: "ai-availability", budget: 60000,
    title: `Fallback model ${GEN_MODEL} answers (5 parallel calls)`,
    hypothesis: "The provider's default model is a viable fallback.",
    run: async (ctx) => {
      const r = await ping(ctx, GEN_MODEL, 5);
      return { score: r.ok / r.n, notes: `${r.ok}/${r.n} succeeded: ${summarise(r.out)}; median ${r.out.map((o) => o.ms).sort((a, b) => a - b)[2]}ms`, data: r.out };
    },
  },
  {
    id: "E003", area: "ai-availability", budget: 90000,
    title: "Model sweep: which Gemini text models are usable now (3 calls each)",
    hypothesis: "At least one stronger model than flash-lite is usable, so the configured choice is the problem, not the key.",
    run: async (ctx) => {
      const models = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"];
      const rows = await Promise.all(models.map(async (m) => ({ m, ...(await ping(ctx, m, 3)) })));
      const usable = rows.filter((r) => r.ok === r.n);
      return { score: usable.length / rows.length, notes: rows.map((r) => `${r.m}: ${r.ok}/${r.n} (${summarise(r.out)})`).join("; "), data: rows };
    },
  },
  {
    id: "E004", area: "ai-reliability", budget: 100000,
    title: "App chat() on configured model settles (error or answer) within 60s",
    hypothesis: "When Gemini is overloaded the app surfaces an error quickly instead of hanging.",
    run: async (ctx) => {
      setRaw(true); // exercise the app exactly as shipped: no harness timeout/retry/reroute
      try {
        const runs = await Promise.all(
          Array.from({ length: 3 }, async () => {
            const t0 = Date.now();
            const settle = ctx.ai.chat({ messages: [{ role: "user", content: "Reply with OK" }], maxTokens: 50 }).then(() => "answer", (e) => `error: ${e.message.slice(0, 80)}`);
            const r = await Promise.race([settle, new Promise((res) => setTimeout(() => res("STILL HANGING at 60s"), 60000))]);
            return { r, ms: Date.now() - t0 };
          }),
        );
        const settled = runs.filter((x) => !x.r.startsWith("STILL"));
        return { score: settled.length / runs.length, notes: runs.map((x) => `${x.r} (${x.ms}ms)`).join(" | "), data: runs };
      } finally {
        setRaw(false);
      }
    },
  },
  {
    id: "E005", area: "ai-errors",
    title: "Invalid API key produces a clear, bounded error",
    hypothesis: "A wrong key yields a readable AiRequestError, not a crash or hang.",
    run: async (ctx) => {
      setRaw(true);
      try {
        await ctx.ai.chat({ messages: [{ role: "user", content: "hi" }] }, { ...ctx.base, apiKey: "AIzaSy-not-a-real-key", model: GEN_MODEL });
        return { score: 0, notes: "No error thrown for an invalid key" };
      } catch (e) {
        const good = e.name === "AiRequestError" && /\b(400|401|403)\b/.test(e.message) && e.message.length <= 500;
        return { score: good ? 1 : 0.5, notes: `${e.name}: ${e.message.slice(0, 200)}` };
      } finally {
        setRaw(false);
      }
    },
  },
  {
    id: "E006", area: "ai-errors",
    title: "Unknown model name produces a clear error",
    hypothesis: "A typo'd model gives a 404-style message the user can act on.",
    run: async (ctx) => {
      setRaw(true);
      try {
        await ctx.ai.chat({ messages: [{ role: "user", content: "hi" }] }, ctx.prov("gemini-9.9-imaginary"));
        return { score: 0, notes: "No error thrown" };
      } catch (e) {
        const good = /404|not found/i.test(e.message);
        return { score: good ? 1 : 0.5, notes: `${e.name}: ${e.message.slice(0, 200)}` };
      } finally {
        setRaw(false);
      }
    },
  },
  {
    id: "E007", area: "ai-errors",
    title: "Unconfigured purpose raises AiNotConfiguredError",
    hypothesis: "Missing provider assignment yields the friendly 'set up a provider' message.",
    run: async (ctx) => {
      try {
        await ctx.ai.resolveProvider("summarisation-not-assigned");
        return { score: 0, notes: "resolved unexpectedly" };
      } catch (e) {
        return { score: e.name === "AiNotConfiguredError" ? 1 : 0, notes: `${e.name}: ${e.message}` };
      }
    },
  },
  {
    id: "E008", area: "security",
    title: "API key is encrypted at rest (AES-GCM, random IV)",
    hypothesis: "The DB never stores the key in plain text and ciphertexts are non-deterministic.",
    run: async (ctx) => {
      const row = await ctx.db.aiProvider.findFirst();
      const plain = ctx.crypto.decrypt(row.apiKeyEnc);
      const checks = {
        notPlain: !row.apiKeyEnc.includes(plain),
        roundTrip: ctx.crypto.decrypt(ctx.crypto.encrypt("x-123")) === "x-123",
        randomIv: ctx.crypto.encrypt("same") !== ctx.crypto.encrypt("same"),
        masked: !ctx.crypto.maskKey(plain).includes(plain.slice(4, -4)),
      };
      let tamper = false;
      try {
        const b = Buffer.from(row.apiKeyEnc, "base64");
        b[b.length - 1] ^= 1;
        ctx.crypto.decrypt(b.toString("base64"));
      } catch {
        tamper = true;
      }
      checks.tamperDetected = tamper;
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: JSON.stringify(checks) };
    },
  },
  {
    id: "E009", area: "ai-parsing",
    title: "parseJsonLoose handles common model output shapes",
    hypothesis: "Fenced, prose-wrapped and trailing-text JSON all parse.",
    run: async (ctx) => {
      const cases = {
        plain: '{"a":1}',
        fenced: '```json\n{"a":1}\n```',
        fencedNoLang: '```\n{"a":1}\n```',
        prose: 'Here you go:\n{"a":1}\nHope that helps!',
        array: '[{"a":1}]',
        nestedBraceInString: '{"a":"x } y"}',
        trailingFenceText: '```json\n{"a":1}\n```\nLet me know.',
        twoObjects: '{"a":1}\n{"b":2}',
      };
      const res = Object.fromEntries(Object.entries(cases).map(([k, v]) => {
        try {
          const r = ctx.ai.parseJsonLoose(v);
          const want = k === "nestedBraceInString" ? r?.a === "x } y" : r && (r.a === 1 || r[0]?.a === 1);
          return [k, want ? "ok" : `wrong:${JSON.stringify(r)}`];
        } catch (e) {
          return [k, "throws"];
        }
      }));
      const ok = Object.values(res).filter((x) => x === "ok").length;
      return { score: ok / Object.keys(cases).length, notes: Object.entries(res).map(([k, v]) => `${k}=${v}`).join(" ") };
    },
  },
  {
    id: "E010", area: "ai-reliability",
    title: "Tiny maxTokens (30, used for chat titles) still returns text",
    hypothesis: "Thinking models may spend the 30-token budget on reasoning and return nothing.",
    run: async (ctx) => {
      // 3.7-flash was dropped after it hung in E003; this measures the token-budget behaviour, not availability.
      const models = [GEN_MODEL, "gemini-3.5-flash", "gemini-3.6-flash"];
      const rows = [];
      setRaw(true);
      for (const m of models) {
        try {
          const t = await ctx.ai.chat({ messages: [{ role: "user", content: 'Give a 3-6 word title for a chat that starts with: "Help me prepare for tomorrow\'s session with a client who has panic attacks". Reply with the title only.' }], maxTokens: 30 }, ctx.prov(m));
          rows.push({ m, t, ok: t.trim().split(/\s+/).length >= 2 });
        } catch (e) {
          rows.push({ m, t: `ERR ${e.message.replace(/\s+/g, " ").slice(0, 80)}`, ok: false, err: true });
        }
      }
      setRaw(false);
      const measured = rows.filter((r) => !r.err);
      if (!measured.length) return { score: 0, status: "crash", notes: "no model reachable" };
      return { score: measured.filter((r) => r.ok).length / measured.length, notes: rows.map((r) => `${r.m}: "${r.t}"`).join(" | ") + " (unreachable models excluded from score)", data: rows };
    },
  },
  {
    id: "E011", area: "ai-reliability",
    title: "chatJson returns valid JSON with the requested keys (5 calls)",
    hypothesis: "JSON mode on Gemini is dependable for small schemas.",
    run: async (ctx) => {
      const rs = await Promise.all(Array.from({ length: 5 }, (_, i) =>
        ctx.ai.chatJson({ messages: [{ role: "user", content: `Return {"n": ${i}, "word": "<any English word>", "list": [1,2,3]}` }], maxTokens: 500 }).then((r) => r?.n === i && typeof r.word === "string" && r.list?.length === 3, () => false)));
      const ok = rs.filter(Boolean).length;
      return { score: ok / 5, notes: `${ok}/5 valid` };
    },
  },
  {
    id: "E012", area: "rendering",
    title: "textToHtml escapes model output (no HTML injection) and renders bullets",
    hypothesis: "AI note text is escaped before it is stored as HTML.",
    run: async (ctx) => {
      const h = ctx.fmt.textToHtml('Para with <script>alert(1)</script> & <img src=x onerror=alert(1)>\n\n- one\n- two "q"');
      const checks = { noScript: !h.includes("<script"), noImg: !h.includes("<img"), bullets: h.includes("<ul><li>one</li>"), quotes: h.includes("&quot;q&quot;") };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)} → ${h.slice(0, 160)}` };
    },
  },
  {
    id: "E013", area: "security",
    title: "Assistant markdownToHtml resists HTML/attribute injection",
    hypothesis: "Raw HTML is escaped; but link hrefs use single quotes that are not escaped, enabling attribute breakout.",
    run: async (ctx) => {
      const cases = {
        script: ctx.md.markdownToHtml("<script>alert(1)</script>"),
        img: ctx.md.markdownToHtml("<img src=x onerror=alert(1)>"),
        jsLink: ctx.md.markdownToHtml("[click](javascript:alert(1))"),
        quoteBreakout: ctx.md.markdownToHtml("[click](https://example.com/'onmouseover='alert(1)'x='y)"),
      };
      const res = {
        script: !cases.script.includes("<script"),
        img: !cases.img.includes("<img"),
        jsLink: !/href='javascript:/i.test(cases.jsLink),
        // Browsers still create the attribute when whitespace is missing after the closing quote.
        quoteBreakout: !/'\s*onmouseover=/i.test(cases.quoteBreakout),
      };
      const v = Object.values(res);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(res)}; breakout html: ${cases.quoteBreakout}`, data: cases };
    },
  },
  {
    id: "E014", area: "rendering",
    title: "stripHtml / sectionsToText round-trip preserves text",
    hypothesis: "Note HTML converts back to readable text for AI context and compliance.",
    run: async (ctx) => {
      const src = "First para & <b>x</b>\nline two\n\n- a\n- b";
      const back = ctx.fmt.stripHtml(ctx.fmt.textToHtml(src));
      const st = ctx.clinical.sectionsToText([{ title: "Plan", html: ctx.fmt.textToHtml("Do 3 & 4") }]);
      const checks = { amp: back.includes("First para & <b>x</b>"), lines: back.includes("line two"), bullets: back.includes("a\nb"), section: st === "Plan\nDo 3 & 4" };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)} sectionsToText=${JSON.stringify(st)}` };
    },
  },
  {
    id: "E015", area: "measures",
    title: "PHQ-9 / GAD-7 scoring and severity bands are correct at every boundary",
    hypothesis: "Measure scores sum correctly and map to standard bands.",
    run: async (ctx) => {
      const phq = ctx.library.FORM_LIBRARY.find((f) => f.measure === "PHQ9");
      const scaleFields = phq.fields.map((f, i) => ({ id: f.id ?? `q${i}`, ...f })).filter((f) => f.type === "scale");
      const answersFor = (target) => {
        const a = {};
        let left = target;
        for (const f of scaleFields) {
          const s = Math.min(3, left);
          a[f.id] = f.options[f.scores.indexOf(s)];
          left -= s;
        }
        return a;
      };
      const expected = { 0: "Minimal", 4: "Minimal", 5: "Mild", 9: "Mild", 10: "Moderate", 14: "Moderate", 15: "Moderately severe", 19: "Moderately severe", 20: "Severe", 27: "Severe" };
      const res = Object.entries(expected).map(([s, band]) => {
        const r = ctx.forms.measureResult("PHQ9", scaleFields, answersFor(Number(s)));
        return { s: Number(s), got: r, ok: r?.score === Number(s) && r?.severity === band };
      });
      const gad = { 4: "Minimal", 5: "Mild", 10: "Moderate", 15: "Severe", 21: "Severe" };
      const gres = Object.entries(gad).map(([s, b]) => ({ s, ok: ctx.library.severity("GAD7", Number(s)) === b }));
      const all = [...res, ...gres];
      return { score: all.filter((r) => r.ok).length / all.length, notes: `PHQ-9 items=${scaleFields.length}; failures: ${all.filter((r) => !r.ok).map((r) => r.s).join(",") || "none"}`, data: res };
    },
  },
  {
    id: "E016", area: "forms",
    title: "Form validation enforces required fields and consent",
    hypothesis: "Missing required answers and a 'No' consent are rejected; headings ignored.",
    run: async (ctx) => {
      const fields = [
        { id: "h", type: "heading", label: "Intro", required: true },
        { id: "n", type: "short_text", label: "Name", required: true },
        { id: "c", type: "yes_no", label: "I consent to treatment", required: true },
        { id: "m", type: "multi_choice", label: "Symptoms", required: true, options: ["a", "b"] },
      ];
      const v = ctx.forms.validateAnswers;
      const checks = {
        missingName: v(fields, { c: "Yes", m: ["a"] }) !== null,
        consentNo: v(fields, { n: "A", c: "No", m: ["a"] }) !== null,
        emptyMulti: v(fields, { n: "A", c: "Yes", m: [] }) !== null,
        whitespaceName: v(fields, { n: "   ", c: "Yes", m: ["a"] }) !== null,
        valid: v(fields, { n: "A", c: "Yes", m: ["a"] }) === null,
      };
      const vals = Object.values(checks);
      return { score: vals.filter(Boolean).length / vals.length, notes: JSON.stringify(checks) };
    },
  },
  {
    id: "E017", area: "data-io",
    title: "CSV parser/serializer round-trips tricky values",
    hypothesis: "Quotes, commas, newlines, BOM and CRLF survive a round trip.",
    run: async (ctx) => {
      const rows = [["name", "note"], ['O"Brien, Pat', "line1\nline2"], ["Zoë", ""], ["  spaced ", "a,b,c"]];
      const back = ctx.csv.parseCsv("\uFEFF" + ctx.csv.toCsv(rows));
      const ok = JSON.stringify(back) === JSON.stringify(rows);
      return { score: ok ? 1 : 0, notes: ok ? "exact round trip" : `got ${JSON.stringify(back)}` };
    },
  },
  {
    id: "E018", area: "security",
    title: "CSV export neutralises spreadsheet formula injection",
    hypothesis: "Client-controlled values like '=HYPERLINK(...)' are prefixed so Excel won't execute them.",
    run: async (ctx) => {
      const out = ctx.csv.toCsv([["=HYPERLINK(\"http://evil.test\",\"click\")", "+1+1", "-2+3", "@SUM(A1)"]]);
      const safe = !/(^|,)"?[=+\-@]/.test(out);
      return { score: safe ? 1 : 0, notes: `toCsv output: ${out}` };
    },
  },
  {
    id: "E019", area: "security",
    title: "Upload reader blocks path traversal (incl. sibling-prefix dirs)",
    hypothesis: "'../.env' is blocked, but 'uploads_x/...' passes the startsWith(ROOT) check.",
    run: async (ctx) => {
      const probeDir = path.join(APP, "uploads_probe");
      mkdirSync(probeDir, { recursive: true });
      writeFileSync(path.join(probeDir, "secret.txt"), "SIBLING-SECRET");
      const tryRead = async (rel) => ctx.storage.readUpload(rel).then((b) => `READ:${b.toString().slice(0, 20)}`, (e) => `blocked:${e.code ?? e.message}`);
      try {
        const res = { dotdotEnv: await tryRead("../.env"), sibling: await tryRead("../uploads_probe/secret.txt"), abs: await tryRead("C:/Windows/win.ini") };
        const blocked = Object.values(res).filter((r) => r.startsWith("blocked")).length;
        return { score: blocked / 3, notes: Object.entries(res).map(([k, v]) => `${k}=${v.startsWith("READ:.env") || k === "dotdotEnv" && v.startsWith("READ") ? "READ(.env contents)" : v}`).join(" ") };
      } finally {
        rmSync(probeDir, { recursive: true, force: true });
      }
    },
  },
  {
    id: "E020", area: "security",
    title: "Unauthenticated requests are rejected (APIs 401, pages → /login)",
    hypothesis: "Every staff API and page requires a session.",
    run: async (ctx) => {
      const checks = [
        ["/api/assistant", "GET", 401],
        ["/api/search?q=Jordan", "GET", 401],
        ["/api/sessions", "POST", 401],
        ["/api/export/sessions", "GET", 401],
        ["/api/files/sessions/x.webm", "GET", 401],
        ["/home", "GET", 307],
        ["/clients", "GET", 307],
        ["/settings/ai", "GET", 307],
      ];
      const res = [];
      for (const [p, method, want] of checks) {
        const r = await ctx.http(p, { auth: false, method, timeoutMs: 90000 });
        res.push({ p, got: r.status, ok: r.status === want && (want !== 307 || r.location?.includes("/login")), loc: r.location });
      }
      return { score: res.filter((r) => r.ok).length / res.length, notes: res.map((r) => `${r.p}=${r.got}${r.ok ? "" : "✗"}`).join(" "), data: res };
    },
  },
  {
    id: "E021", area: "security",
    title: "Forged / expired / alg:none session tokens are rejected",
    hypothesis: "JWT verification rejects tokens not signed with APP_SECRET.",
    run: async (ctx) => {
      const { SignJWT } = appRequire("jose");
      const forged = await new SignJWT({ sub: ctx.user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode("wrong-secret"));
      const expired = await new SignJWT({ sub: ctx.user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(1000).setExpirationTime(2000).sign(new TextEncoder().encode(process.env.APP_SECRET));
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: ctx.user.id })}.`;
      const res = {};
      for (const [k, t] of Object.entries({ forged, expired, none })) res[k] = (await ctx.http("/api/search?q=a", { auth: t })).status;
      res.valid = (await ctx.http("/api/search?q=a")).status;
      const ok = res.forged === 401 && res.expired === 401 && res.none === 401 && res.valid === 200;
      return { score: ok ? 1 : 0, notes: JSON.stringify(res) };
    },
  },
  {
    id: "E022", area: "routes", budget: 900000,
    title: "Page sweep: clinical workflow pages render",
    hypothesis: "Home, calendar, sessions, clients (all tabs), capture and templates render without server errors.",
    run: async (ctx) => {
      const { client, session, template } = await ids(ctx);
      const c = `/clients/${client.id}`;
      return sweep(ctx, ["/home", "/calendar", "/sessions", `/sessions/${session.id}`, "/clients", "/clients/new", "/clients/import", c, `${c}/summary`, `${c}/treatment-plan`, `${c}/forms`, `${c}/insights`, `${c}/chart-notes`, `${c}/files`, `${c}/billing`, `${c}/edit`, "/capture", "/capture/record", "/capture/upload", "/capture/write", "/templates", "/templates/new", "/templates/convert", `/templates/${template.id}`]);
    },
  },
  {
    id: "E023", area: "routes", budget: 900000,
    title: "Page sweep: billing & insurance pages render",
    hypothesis: "All payments/insurance screens render with an almost-empty ledger.",
    run: async (ctx) => sweep(ctx, ["/billing", "/billing/analytics", "/billing/invoices/new", "/billing/payments", "/billing/payments/new", "/billing/statements", "/billing/superbills", "/billing/unbilled", "/insurance", "/insurance/claims/new", "/insurance/payments", "/insurance/unbilled"]),
  },
  {
    id: "E024", area: "routes", budget: 900000,
    title: "Page sweep: all settings pages render",
    hypothesis: "Every settings screen renders for an admin.",
    run: async (ctx) => sweep(ctx, ["/settings", ...["ai", "assistant", "audit", "availability", "billing", "billing-profiles", "calendars", "clinical", "compliance", "imports", "messaging", "notes", "payers", "portal", "practice", "profile", "reminders", "services", "sessions-overview", "team"].map((s) => `/settings/${s}`)]),
  },
  {
    id: "E025", area: "routes", budget: 900000,
    title: "Page sweep: forms, compliance, reports, inbox, telehealth",
    hypothesis: "The remaining staff screens render.",
    run: async (ctx) => {
      const { form } = await ids(ctx);
      return sweep(ctx, ["/forms", "/forms/library", "/forms/packets", "/forms/requests", "/forms/convert", `/forms/${form.id}`, "/compliance", "/reports", "/inbox", "/telehealth", "/telehealth/room"]);
    },
  },
  {
    id: "E026", area: "routes", budget: 600000,
    title: "Public pages work, and bad tokens/ids give 404 rather than 500",
    hypothesis: "Client-facing pages render for valid tokens and fail cleanly for invalid ones.",
    run: async (ctx) => {
      const { client } = await ids(ctx);
      const p = await ctx.db.practice.findFirst();
      const checks = [
        [`/portal/${client.portalToken}`, [200], false],
        [`/book/${p.slug}`, [200], false],
        ["/login", [200], false],
        ["/portal/not-a-real-token", [404], false],
        ["/f/not-a-real-token", [404], false],
        ["/join/not-a-room", [404, 200], false],
        ["/invite/not-a-token", [404, 200, 307], false],
        ["/api/public/ical/not-a-token", [404, 401, 403], false],
        ["/book/no-such-practice", [404], false],
        ["/sessions/does-not-exist", [404], true],
        ["/clients/does-not-exist", [404], true],
        ["/billing/invoices/does-not-exist", [404], true],
        ["/insurance/claims/does-not-exist", [404], true],
      ];
      const res = [];
      for (const [path_, want, auth] of checks) {
        const r = await ctx.http(path_, { auth, timeoutMs: 120000 });
        res.push({ p: path_, got: r.status, ok: want.includes(r.status) });
      }
      return { score: res.filter((r) => r.ok).length / res.length, notes: res.map((r) => `${r.p}=${r.got}${r.ok ? "" : "✗"}`).join(" "), data: res };
    },
  },
  {
    id: "E027", area: "search",
    title: "Global search finds the client and survives hostile input",
    hypothesis: "Search returns the demo client and handles SQL-ish / wildcard input without error.",
    run: async (ctx) => {
      const j = async (q) => {
        const r = await ctx.http(`/api/search?q=${encodeURIComponent(q)}`);
        return { status: r.status, items: r.status === 200 ? JSON.parse(r.text) : r.text.slice(0, 80) };
      };
      const found = await j("Jordan");
      const lower = await j("jordan");
      const sqli = await j("' OR 1=1 --");
      const pct = await j("%");
      const checks = {
        finds: found.items.some?.((i) => i.type === "client"),
        caseInsensitive: lower.items.some?.((i) => i.type === "client"),
        sqliSafe: sqli.status === 200 && sqli.items.length === 0,
        wildcardLiteral: pct.status === 200,
      };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; '%' returned ${pct.items.length} items` };
    },
  },
  {
    id: "E028", area: "data-io",
    title: "Sessions CSV export downloads with headers and rows",
    hypothesis: "Admin export returns a well-formed CSV including the demo session.",
    run: async (ctx) => {
      const r = await ctx.http("/api/export/sessions");
      const rows = ctx.csv.parseCsv(r.text);
      const ok = r.status === 200 && /csv/.test(r.headers.get("content-type") ?? "") && rows.length >= 2;
      return { score: ok ? 1 : 0, notes: `status ${r.status}, type ${r.headers.get("content-type")}, ${rows.length} rows; header: ${rows[0]?.join("|").slice(0, 160)}` };
    },
  },
  {
    id: "E029", area: "security",
    title: "File API refuses path traversal over HTTP",
    hypothesis: "Encoded ../ cannot read .env or the database through /api/files.",
    run: async (ctx) => {
      const probes = ["..%2F.env", "..%2F..%2F.env", "..%2Fprisma%2Fdev.db", "%2e%2e%2f.env", "..%5C.env"];
      const res = [];
      for (const p of probes) {
        const r = await ctx.http(`/api/files/${p}`);
        res.push({ p, status: r.status, leaked: r.status === 200 && /APP_SECRET|SQLite format/.test(r.text) });
      }
      const safe = res.filter((r) => !r.leaked).length;
      return { score: safe / res.length, notes: res.map((r) => `${r.p}=${r.status}${r.leaked ? " LEAKED" : ""}`).join(" ") };
    },
  },
  {
    id: "E030", area: "security",
    title: "Middleware public-prefix matching is exact",
    hypothesis: "Paths that merely start with a public prefix (e.g. /bookkeeping, /portalx) are still treated as private.",
    run: async (ctx) => {
      const res = [];
      for (const p of ["/bookkeeping", "/portalx", "/joinus", "/loginx", "/api/publicity"]) {
        const r = await ctx.http(p, { auth: false, timeoutMs: 90000 });
        res.push({ p, status: r.status, private: r.status === 307 || r.status === 401 });
      }
      return { score: res.filter((r) => r.private).length / res.length, notes: res.map((r) => `${r.p}=${r.status}`).join(" ") + " (404 = middleware let it through as public)" };
    },
  },
];
