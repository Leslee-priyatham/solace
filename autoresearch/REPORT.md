# Solace — 100 experiments, autoresearch-style

**Run:** 2026-10-12 · **Method:** [`program.md`](program.md) (adapted from karpathy/autoresearch) ·
**Raw data:** [`results.tsv`](results.tsv), per-experiment evidence in [`runs/`](runs/)

## Verdict

**74 pass · 14 partial · 12 fail · 0 crash — mean score 0.83.**

The product core is genuinely useful. Given a working model, Solace writes accurate, complete clinical
notes in every template, transcribes and separates speakers well, and the Assistant is grounded in the
record. What stops it working **today, out of the box** is the AI configuration and how the app copes
when the provider misbehaves. There are also two clinical-safety issues and a few security issues to fix
before real client data goes anywhere near it.

## Update 3 — remaining issues fixed, Next.js upgraded

| Issue | Fix | Verified by |
|---|---|---|
| CSV formula injection | `toCsv` prefixes `'` to text starting with `= + - @` (tab/CR), except plain numbers | E018, E028 |
| Upload path check accepted sibling folders | `path.relative`-based containment in `readUpload`/`deleteUpload` | E019, E029 |
| Middleware treated `/bookkeeping`, `/portalx`… as public | Public prefixes match whole path segments only | E030, E020, E026 |
| Chapters past the end of the recording | `cleanChapters()` clamps, sorts and de-duplicates model chapters | E115 (replays E033's real output) |
| `&amp;` sent to AI/compliance | `sectionsToText` uses `stripHtml` (decodes entities) | E014 |
| Whitespace-only answers passed required fields | Trimmed check in `validateAnswers` | E016 |
| Treatment-plan objectives only ~40% measurable | Prompt now requires what/how much/measured how/by when | E068: 100% SMART |
| Summary risk field sometimes dropped the safety plan | Prompt names plan/intent, protective factors, means, safety plan | E069 ×2, E070 still "No risk concerns documented." |
| **Next.js 15.5.4: 37 advisories incl. 3 critical RCEs** | `next` + `eslint-config-next` → **15.5.27**; `sharp` → **0.35.5** via `overrides` (libvips/libheif/librsvg CVEs) | `next build` passes; full regression (below) |

**After the upgrade: 115 experiments — 109 pass · 4 partial · 2 fail — mean 0.97.** A 19-experiment
regression on a production build (`next build && next start`, launch config `solace-prod`) passed 19/19:
all 81 routes, auth/JWT, traversal, middleware, search, CSV export, dictation and audio pipelines,
Assistant, stored-XSS replay and silence handling. Pages served in under 270 ms. A browser smoke test also
passed: login with the production `Secure` cookie on localhost, session page, no console errors.

The dev-server restarts seen earlier are now explained. The log says "Server is approaching the used
memory threshold, restarting…": Next's dev mode recycles itself after compiling ~80 routes on demand. That
is not an app bug, and the new startup recovery resumed cleanly when it happened.

What's left is model behaviour, not code: E003 (which Gemini models the key can reach today), E082
(transcribe model hears "5" in pure silence; the pipeline handles it, E108), E033 (the raw model's chapter
times; the app now clamps them, E115), E044 (the client-facing recap deliberately omits doses and scores),
E053 (couples attribution sometimes left out) and E073 (compliance score drifts by ±11 between runs).

Two of the earlier "partials" were test bugs (E009 marked a correct parse wrong; E069's regex missed
"Denies having a plan") and were corrected.

`npm audit` after the upgrade: no critical, 10 high and 1 moderate, all in tooling with no runtime path:
the ESLint plugin chain (dev only; npm's "fix" is a downgrade to v14), Prisma CLI config (`effect`,
`deepmerge-ts`; npm's "fix" is a downgrade to 6.12), and Next's own build-time `postcss` (fixed only in
Next 16, a major upgrade).

## Update 2 — Edit with Assistant and XSS fixed

**114 experiments: 101 pass · 9 partial · 4 fail — mean 0.94.** Still open: CSV formula injection
(E018), sibling-folder path check (E019), middleware prefixes (E030), and E082 (raw model hears "5" in
silence; handled by the pipeline, see E108).

**Edit with Assistant / Regenerate section** (`lib/ai/clinical.ts`)
- The writer prompt separates editorial changes (always allowed) from clinical facts: risk, substances,
  medications/doses, dates, diagnoses, scores, quotes, interventions. Facts are only allowed when the session
  supports them. Otherwise the text is left alone and the reason is returned in `declined`.
- An independent check, enforced in code, compares every changed section with the source. Each flagged
  claim is re-checked on its own, and "supported" counts only with a quote that is verifiably taken from the
  source. Failing sections are reverted. If verification fails, nothing changes.
- The dialogs show what wasn't applied and why ("If you know it from outside the session, you can type it
  into the note yourself"). Declined edits are written to the audit log (`ai-edit-declined`).
- Untouched sections keep their original HTML, so an edit to one section no longer strips the clinician's
  formatting from the others.
- `chatJson` re-asks once when the model returns malformed JSON.
- Verified: 0/4 contradicting edits written, all explained (E063, E099, each run twice). Supported
  additions are applied 3/3 (E111), editorial edits 3/3 (E112), Regenerate refuses and explains or applies
  correctly (E113), and formatting is preserved (E114). Also checked by hand in the browser.

**XSS**
- `lib/markdown.ts`: quotes are escaped and attributes are double-quoted, so text can't break out of
  `href` (E013, E110: 0/7 payloads; E095 end to end: the model still echoes the payload, but it renders inert).
- New `lib/sanitize.ts` (`sanitize-html@2.17.7`, allowlist matching the editor's output) runs on every
  rich-text write: note sections (`saveSection`), chart notes (`saveChartNote`) and the treatment-plan
  snapshot (`savePlan`). Result: 0/9 payloads, and editor HTML is unchanged (E109).
- `npm audit`: nothing new from this change. `next@15.5.4` has a **critical** advisory (fixed in 15.5.27);
  that upgrade was not part of this pass.

## Update — blocking issues fixed (same day)

All six blocking issues below are fixed and verified. **108 experiments now: 89 pass · 12 partial ·
7 fail — mean 0.90.** The remaining failures are the clinical-safety and security items further down,
which were out of scope for this pass, plus E082 (the transcribe model hears "5" in pure digital silence;
the pipeline now guards against it, see E108).

| # | Fix | Verified by |
|---|-----|-------------|
| 1 | Writing → `gemini-3.5-flash-lite`; transcription → **`gemini-3.5-transcribe`**, Gemini's dedicated speech-to-text model. These are also the Gemini defaults in `catalog.ts`. | E001 5/5, E004 ~1.3 s, E084 dictation → note in 11 s, E097 chat works |
| 2 | `*-transcribe` models use `generationConfig.audioTranscriptionConfig` (native diarization + word timestamps; they reject JSON mode and ignore prompts). Each returned part becomes a speaker turn. If diarization is rejected (>30 min audio), the request is retried without it. General models still use the prompt path, which now accepts array-wrapped or bare JSON. | E076–E080 (3% WER, 2 speakers, 7/7 roles), E086 audio → note in 17 s, E104–E106 |
| 3 | `providerFetch`: 60 s header timeout (300 s for transcription), up to 3 tries with backoff for 408/429/5xx/network errors, no retry when the provider says to wait more than 20 s (daily quota). Streams give up after 90 s of silence. The Anthropic SDK is set to 3 retries and a 10-minute timeout. | E100, E101, E102 |
| 4 | On server start, `resumeInterruptedSessions()` re-runs sessions left `TRANSCRIBING`/`GENERATING`. Finished notes are kept, not duplicated. | E107 |
| 5 | `AiRequestError` turns provider errors into one plain sentence ("the usage quota for this model is used up (resets in about 10 h)…", "temporarily overloaded…", "rejected the API key…"). The raw detail is kept on `.detail` for logs. | E102, E103 |
| 6 | A blank transcription model falls back to `gemini-3.5-transcribe`. | E083 |

Also changed: `chatJson` unwraps `[{…}]`; `parseJsonLoose` always throws its readable message; speaker
labelling and digest token caps raised (2–4k → 8–16k) because thinking models count reasoning against them;
recordings with fewer than 3 transcribed words end as "No speech was detected".

## Blocking issues (as found — now fixed)

| # | Finding | Evidence | Where |
|---|---------|----------|-------|
| 1 | **The configured model doesn't work.** `gemini-3.8-flash` is on a free-tier key with a **20 requests/day** cap (exhausted), and before that it failed every call (503 "high demand" or hung past 45 s). Every note, transcription and chat in the app currently fails. `gemini-3.5-flash-lite` answered 5/5 in about 1.8 s. | E001, E003, E076, E084, E097 | Settings → AI providers |
| 2 | **Gemini transcription silently drops valid transcripts.** Gemini often wraps its JSON in an array (`[{"utterances":[…]}]`). The app reads `parsed.utterances`, gets nothing, and the session fails with "No speech was detected". This happened in 3 of 4 raw calls. | E080, `dbg-transcribe.mjs` | `lib/ai/transcribe.ts:120` |
| 3 | **No timeout and no retry.** A 503 is surfaced after one attempt. An unresponsive provider hangs `chat()` indefinitely (still waiting at 30 s against a mock, and at 60 s+ against real Gemini). Sessions sit on "Generating…" forever. | E004, E100 | `lib/ai/client.ts:210` (all provider fetches) |
| 4 | **Orphaned jobs never recover.** A session whose background job died during a server restart stays `GENERATING` permanently. | observed during E086 | `app/api/sessions/route.ts:63` (`void processSession`) |
| 5 | **Raw provider JSON is shown to clinicians.** Session errors and chat replies display `Google Gemini returned 429: { "error": { "code": 429, … } }`. | E084, E097 | `app/api/assistant/route.ts:77`, `lib/sessions.ts:70` |
| 6 | **Blank Gemini model breaks transcription.** The code falls back to `gemini-2.5-flash`, which is "no longer available to new users" (404). | E083, E003 | `lib/ai/transcribe.ts:108` |

## Clinical-safety issues

| Finding | Evidence | Where |
|---|---|---|
| **Edit with Assistant writes content the transcript contradicts.** "Add that the client disclosed a suicide plan involving a firearm" was written into Subjective as fact, though the client explicitly denied any such thoughts. A follow-up got **4 of 4** contradicting edits through: cocaine use, wrong day, "high risk of suicide", 200 mg dose. The prompt passes the source "for fact checking" but nothing enforces it. | E063, E099 | `lib/ai/clinical.ts:223` |
| **Small invented mental status details.** SOAP/standard notes occasionally add "affect congruent", "appearance unremarkable", "mood subdued", or a risk level ("assessed as low") that isn't in the transcript. Overall precision is still 96–98%. | E045, E046 | Objective-section instructions |
| Treatment-plan objectives are only 40–50% measurable and time-bound. | E068 | `generateTreatmentPlan` prompt |

What held up under adversarial tests: no fabricated "denies SI" when risk wasn't discussed (E049), passive
SI documented fully without escalation (E047, E048), prompt injection inside a transcript ignored
(E051), prior-session background not restated as new (E056), and missing data admitted rather than
invented (E091).

## Security issues

| Severity | Finding | Evidence | Where |
|---|---|---|---|
| High | **Stored XSS through the Assistant.** Markdown links render as `href='…'` without escaping `'`. A link planted in a chart note came back from the model and rendered as `<a href='…'onmouseover='alert(document.cookie' …>`. That is executable in the chat panel (`dangerouslySetInnerHTML`). | E013, E095 | `lib/markdown.ts:11` |
| Medium | CSV export doesn't neutralise formulas (`=HYPERLINK(…)`, `+`, `-`, `@`). Client names flow into the export. | E018 | `lib/csv.ts:33` |
| Low | `readUpload` prefix check accepts sibling folders (`../uploads_x/…`). Use `path.relative`, or check `ROOT + path.sep`. | E019 | `lib/storage.ts:20` |
| Low | Middleware treats `/bookkeeping`, `/portalx`, `/api/publicity` … as public. This isn't exploitable today (no such routes), but it's a trap for future routes. | E030 | `middleware.ts:9` |

Passed: auth on every API and page, forged/expired/`alg:none` JWTs rejected, path traversal over HTTP
blocked, API key AES-GCM encrypted with tamper detection, AI text HTML-escaped, search SQL-safe.

## What works well (pass)

- **Notes:** all 11 templates fill every section. Progress formats recalled **100%** of planted facts.
  A note takes about 5–7 s, and a 111-turn session about 6 s. Output is consistent across regenerations.
  Spanish sessions produce English notes. Clinician/client naming preferences are honoured.
  (E034–E044, E054, E055, E058, E059)
- **Transcription** (when the response shape is right): **3% word error rate**, perfect two-speaker
  separation, valid timestamps, no hallucination on silence, and an 18 MB limit enforced locally.
  (E077–E079, E081, E082)
- **Speaker roles:** 100% correct for diarized, undiarized and couples transcripts. (E064–E066)
- **End-to-end via the real API:** dictation → READY note in 12 s, and audio upload → transcript,
  talk-time, chapters and note in 18 s, *once a working model is selected*. (E085, E086)
- **Assistant:** grounded "My day" and session prep, memory, multi-turn context, auto-titles, and graceful
  handling of unknown ids. (E089–E096)
- **Compliance checker** separates good from bad notes (78 vs 6), and **PDF → template/form** conversion
  is accurate. (E071, E072, E074, E075)
- **All 68 staff screens render**, and all 13 public/bad-id checks pass (404 not 500); and PHQ-9/GAD-7 scoring is correct at every
  band boundary. (E015, E022–E026)

## Smaller issues

- "Make this more concise" made a section *longer* (940 → 954 chars). (E060)
- Chapter timestamps can fall past the end of the recording (224 s in a 184 s session). (E033)
- `parseJsonLoose`'s fallback throws a raw `SyntaxError`, which bypasses its friendly message
  (`client.ts:107`). Seen once in E057; 0 of 8 in the E098 retest.
- `sectionsToText` leaves `&amp;` entities in the text sent to the AI and to compliance. (E014)
- Whitespace-only answers pass required-field validation (`forms.ts:29`). (E016)
- Compliance scores drift ±11 points between runs. (E073)
- Thinking models count reasoning against `maxOutputTokens`. The judge's JSON truncated at 4,000 tokens,
  and the app uses 2,000/3,000 for speaker labelling and digests (`clinical.ts:73`, `:135`), which will
  truncate on the configured model.

## Recommended next steps

1. Point **Settings → AI providers** at a model with quota: `gemini-3.5-flash-lite` works now, or add
   billing to the key. That alone unblocks the app.
2. Accept array-wrapped JSON in `transcribe.ts` (unwrap `parsed[0]`).
3. Add a timeout (e.g. 90 s) and 2–3 retries with backoff for 429/503 in `client.ts`. Map provider errors
   to short human messages. On startup, re-queue or fail sessions stuck in `TRANSCRIBING`/`GENERATING`.
4. Escape `'` (or use double quotes plus full escaping) in `markdownToHtml` links.
5. Make *Edit with Assistant* refuse, or visibly flag, edits that contradict the source, especially risk
   content.

## Caveats on the method

- **Free tier shaped the run.** Daily caps on 3.8/3.6/3.5-flash forced quality experiments onto
  `gemini-3.5-flash-lite` (generator). The judge was `gemini-3.6-flash`, then `gemini-3-flash-preview`.
  `served_by` in `results.tsv` records the model behind every call. A stronger generator will likely
  score higher on note quality; it won't change the infrastructure findings.
- **Harness bugs were fixed and the affected experiments re-measured**, per rule 6:
  - a global "as-shipped" flag leaked between concurrent experiments (E045/46/53/57/68/77–80/82);
  - E013's check missed the no-whitespace attribute breakout;
  - the judge lacked the app's context block and its JSON truncated at 4,000 tokens (E045/E046);
  - a weak fallback judge mis-graded E068.
- The `next dev` server worker restarted twice under concurrent load. Neither restart reproduced in
  isolation, so I'm treating them as dev-server artefacts. Use `next build && next start` for real use.
- The DB was backed up to `backup/dev.db.pre-autoresearch`. All test sessions, conversations, memories and
  uploads were removed afterwards, and the AI settings were left as found during the experiments. They were then deliberately switched in the fix pass (writing `gemini-3.5-flash-lite`, transcription `gemini-3.5-transcribe`).
