// Round 6 — verifies the Edit-with-Assistant fact check and the XSS fixes, including that legitimate
// edits and formatting still get through (a check that blocks everything would be useless).
import { load } from "../load.mjs";

export const round = 6;

const soapF1 = (ctx) => ctx.clinical.generateNote(ctx.tpl("SOAP"), ctx.sourceOf(ctx.fixtures.F1), ctx.fixtures.F1.ctx);
const changedIds = (before, after) => after.filter((s, i) => s.html !== before[i].html).map((s) => s.id);

export default [
  {
    id: "E109", area: "security",
    title: "Stored rich text is sanitised: attack payloads removed, editor formatting kept intact",
    hypothesis: "sanitizeRichHtml strips scripts/handlers/js: URLs/iframes/styles and leaves TipTap output byte-identical.",
    run: async () => {
      const { sanitizeRichHtml } = await load("lib/sanitize.ts");
      const attacks = {
        script: "<p>a</p><script>alert(1)</script>",
        imgOnerror: '<img src=x onerror="alert(1)">',
        svgOnload: "<svg onload=alert(1)></svg>",
        jsHref: '<a href="javascript:alert(1)">x</a>',
        dataHref: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
        iframe: '<iframe src="https://evil.test"></iframe>',
        handlerOnP: '<p onclick="alert(1)" style="background:url(javascript:alert(1))">x</p>',
        quoteBreak: "<a href=\"https://x.test/'onmouseover='alert(1)\">x</a>",
        nestedTrick: "<scr<script>ipt>alert(1)</script>",
      };
      // Only markup outside quoted attribute values can execute; a quote inside "…" is inert.
      const outsideValues = (h) => h.replace(/"[^"]*"/g, '""');
      const bad = (h) => /<script|<iframe|<svg|<img|\son\w+\s*=|\sstyle\s*=/i.test(outsideValues(h)) || /href="(?!https?:|mailto:)/i.test(h);
      const leaks = Object.entries(attacks).filter(([, h]) => bad(sanitizeRichHtml(h))).map(([k]) => k);
      const tiptap = '<h2>Plan</h2><p><strong>Bold</strong> and <em>italic</em> and <s>strike</s> and <code>x</code></p><ul><li><p>one</p></li></ul><ol start="3"><li><p>three</p></li></ol><blockquote><p>q</p></blockquote><hr><p>line<br>break</p>';
      const selfClose = (h) => h.replace(/<(br|hr) \/>/g, "<$1>");
      const kept = selfClose(sanitizeRichHtml(tiptap)) === tiptap;
      const link = sanitizeRichHtml('<a href="https://example.com/a">site</a>');
      const linkOk = link.includes('href="https://example.com/a"') && link.includes('rel="noopener noreferrer"');
      const score = (1 - leaks.length / Object.keys(attacks).length) * 0.6 + (kept ? 0.3 : 0) + (linkOk ? 0.1 : 0);
      return { score, notes: `leaked: ${leaks.join(",") || "none"} of ${Object.keys(attacks).length}; editor HTML preserved=${kept}${kept ? "" : ` → ${sanitizeRichHtml(tiptap)}`}; safe link=${linkOk}` };
    },
  },
  {
    id: "E110", area: "security",
    title: "Assistant markdown: no attribute breakout with single quotes, double quotes or entities",
    hypothesis: "With quotes escaped and double-quoted attributes, no payload yields an event handler or non-http link.",
    run: async (ctx) => {
      const payloads = [
        "[x](https://a.test/'onmouseover='alert(1)'y=')",
        '[x](https://a.test/"onmouseover="alert(1)"y=")',
        "[x](https://a.test/&#39;onmouseover=&#39;alert(1))",
        "[x](javascript:alert(1))",
        "[x](data:text/html,alert(1))",
        "**<img src=x onerror=alert(1)>**",
        "`</code><script>alert(1)</script>`",
      ];
      const html = payloads.map((p) => ctx.md.markdownToHtml(p));
      // An attribute can only be injected if a raw quote closes the href value.
      const unsafe = html.filter((h) => /<a [^>]*href="[^"]*"[^>]*\son\w+=|<a [^>]*href='|<script|<img|href="(?!https?:)/i.test(h));
      const normal = ctx.md.markdownToHtml("Don't miss **this** — see [docs](https://example.com/a?b=1&c=2).");
      const normalOk = normal.includes('<a href="https://example.com/a?b=1&amp;c=2"') && normal.includes("Don&#39;t") && normal.includes("<strong>this</strong>");
      return { score: (1 - unsafe.length / payloads.length) * 0.8 + (normalOk ? 0.2 : 0), notes: `${unsafe.length}/${payloads.length} unsafe; normal markdown renders=${normalOk}${unsafe.length ? `; e.g. ${unsafe[0]}` : ""}` };
    },
  },
  {
    id: "E111", area: "note-editing", budget: 180000,
    title: "Supported factual additions are still applied (no over-blocking)",
    hypothesis: "Adding facts that ARE in the session (4 h sleep, sertraline 50 mg, Saturday store visit) goes through without declines.",
    run: async (ctx) => {
      const fx = ctx.fixtures.F1;
      // Remove the facts first, so adding them back is a real change the fact check must allow.
      const drop = /sleep|hours a night|sertraline|medication|saturday|quiet morning/i;
      const base = (await soapF1(ctx)).map((s) => {
        const kept = ctx.fmt.stripHtml(s.html).split(/(?<=[.!?])\s+/).filter((x) => !drop.test(x)).join(" ");
        return { ...s, html: ctx.fmt.textToHtml(kept || "Not documented.") };
      });
      const asks = [
        { req: "Add that the client reports sleeping about four hours a night and waking around 3 am.", want: /3\s?(am|a\.m\.)|three/i },
        { req: "Make sure the note mentions sertraline 50 mg started by the PCP about two weeks ago.", want: /sertraline/i },
        { req: "In the plan, add that the client intends to try the grocery store on Saturday morning.", want: /saturday/i },
      ];
      const res = [];
      for (const a of asks) {
        const r = await ctx.clinical.editNote(base, a.req, ctx.sourceOf(fx), fx.ctx);
        res.push({ req: a.req, applied: changedIds(base, r.sections).length > 0 && a.want.test(ctx.noteText(r.sections)), declined: r.declined });
      }
      const ok = res.filter((r) => r.applied && !r.declined.length).length;
      return { score: ok / res.length, notes: res.map((r) => `${r.applied ? "applied" : "NOT applied"}${r.declined.length ? ` (declined: ${r.declined[0].slice(0, 90)})` : ""} — ${r.req.slice(0, 60)}`).join(" | ") };
    },
  },
  {
    id: "E112", area: "note-editing", budget: 180000,
    title: "Editorial edits (first person, concise, objective tone) are applied without declines",
    hypothesis: "The fact check ignores rewording and shortening.",
    run: async (ctx) => {
      const fx = ctx.fixtures.F1;
      const base = await soapF1(ctx);
      const res = [];
      for (const req of ["Write in first person from the therapist's point of view.", "Make the Subjective section more concise.", "Use more objective language throughout."]) {
        const r = await ctx.clinical.editNote(base, req, ctx.sourceOf(fx), fx.ctx);
        res.push({ req, changed: changedIds(base, r.sections).length, declined: r.declined });
      }
      const ok = res.filter((r) => r.changed > 0 && !r.declined.length).length;
      return { score: ok / res.length, notes: res.map((r) => `${r.changed} sections changed, ${r.declined.length} declined${r.declined.length ? ` (${r.declined[0].slice(0, 100)})` : ""} — ${r.req}`).join(" | ") };
    },
  },
  {
    id: "E113", area: "note-editing", budget: 180000,
    title: "Regenerate section: unsupported request refused with a reason; supported one applied",
    hypothesis: "rewriteSection runs the same fact check as Edit with Assistant.",
    run: async (ctx) => {
      const fx = ctx.fixtures.F1;
      const base = await soapF1(ctx);
      const sec = base.find((s) => /subjective/i.test(s.title)) ?? base[0];
      const bad = await ctx.clinical.rewriteSection(sec, "Add that the client drinks a bottle of wine every night.", ctx.sourceOf(fx), fx.ctx);
      const good = await ctx.clinical.rewriteSection(sec, "Mention the interoceptive exposure exercise and keep it under 120 words.", ctx.sourceOf(fx), fx.ctx);
      const checks = {
        badRefused: bad.html === sec.html && !/wine/i.test(bad.html),
        badExplained: bad.declined.length > 0,
        goodApplied: good.declined.length === 0 && good.html !== sec.html,
      };
      const v = Object.values(checks);
      return { score: v.filter(Boolean).length / v.length, notes: `${JSON.stringify(checks)}; told: ${bad.declined.join(" | ").slice(0, 160)}${good.declined.length ? `; good declined: ${good.declined[0].slice(0, 100)}` : ""}` };
    },
  },
  {
    id: "E115", area: "session-digest",
    title: "Chapter markers are kept inside the recording (replaying E033's real output)",
    hypothesis: "Starts past the end are clamped, order is kept, duplicates dropped, junk rows removed.",
    run: async () => {
      const { cleanChapters } = await load("lib/sessions.ts");
      const transcript = [{ start: 0, end: 184, speaker: "CLIENT", text: "x" }];
      const raw = [0, 35, 103, 130, 147, 224, 242].map((start, i) => ({ title: `Ch ${i}`, start }));
      const out = cleanChapters([...raw, { title: "", start: 5 }, { title: "NaN", start: "abc" }], transcript);
      const starts = out.map((c) => c.start);
      const ok = starts.every((s) => s >= 0 && s <= 184) && starts.every((s, i) => i === 0 || s > starts[i - 1]) && out.length === 6;
      return { score: ok ? 1 : 0, notes: `in: [${raw.map((c) => c.start)}] end=184 → out: [${starts}]` };
    },
  },
  {
    id: "E114", area: "note-editing", budget: 180000,
    title: "Editing one section keeps the clinician's formatting in the other sections",
    hypothesis: "Untouched sections keep their original HTML (bold, headings) instead of being rebuilt from plain text.",
    run: async (ctx) => {
      const fx = ctx.fixtures.F1;
      const base = await soapF1(ctx);
      const formatted = base.map((s, i) => (i === 0 ? { ...s, html: `<h3>Client's words</h3><p><strong>Important:</strong> ${ctx.fmt.stripHtml(s.html).slice(0, 300)}</p>` } : s));
      const target = formatted.at(-1);
      const r = await ctx.clinical.editNote(formatted, `In the ${target.title} section only, change "Same time next week" style wording to say the next session is in one week.`, ctx.sourceOf(fx), fx.ctx);
      const first = r.sections[0].html === formatted[0].html;
      const othersSame = r.sections.slice(1, -1).every((s, i) => s.html === formatted[i + 1].html);
      return { score: (first ? 0.6 : 0) + (othersSame ? 0.4 : 0), notes: `formatted section preserved=${first}; middle sections byte-identical=${othersSame}; declined=${r.declined.length}` };
    },
  },
];
