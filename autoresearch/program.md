# autoresearch: Solace functional probe

Adapted from [karpathy/autoresearch](https://github.com/karpathy/autoresearch). There, an agent edits
`train.py`, trains for a fixed 5 minutes, reads one metric (`val_bpb`), keeps or discards the change,
logs a row to `results.tsv`, and repeats ~100 times overnight.

Here the "model" being studied is the **Solace app itself** (`../app`). We don't change the app. Each
experiment is one small, falsifiable hypothesis about what the app can do, measured the same way every time.

| autoresearch            | here                                                                 |
|-------------------------|----------------------------------------------------------------------|
| `prepare.py` (fixed)    | `harness.mjs`, `load.mjs`, `fixtures/` — fixed evaluation harness     |
| `train.py` (edited)     | `experiments/r*.mjs` — new hypotheses are added each round           |
| 5-minute budget         | 120 s per experiment (longer only for page sweeps / audio pipeline)  |
| `val_bpb`               | `score` ∈ [0, 1] (higher is better)                                  |
| keep / discard / crash  | `pass` (≥ 0.8) / `partial` (≥ 0.4) / `fail` / `crash`                |
| `results.tsv`           | `results.tsv` — one row per experiment, never skipped                |

## Rules

1. **One hypothesis, one score.** Every experiment states what it expects and returns a number.
2. **Call the real thing.** AI experiments import the app's own modules (`src/lib/ai/*`) through
   `load.mjs`, so prompts, parsing and guardrails are exactly what ships. Pipeline/assistant experiments
   go through the running dev server's HTTP API, signed in as the local dev account.
3. **Separate availability from quality.** "Is the configured model up?" experiments run *raw* (no
   retries, no timeouts — as shipped). Quality experiments route around an unavailable model so we can
   see whether the feature works when the model does; `served_by` in `results.tsv` records which
   model answered every call.
4. **Independent judge.** Faithfulness is graded by a different model (`gemini-3.6-flash`) from the
   generator (`gemini-3.5-flash-lite`). Recall is checked with keyword groups (no model).
5. **Fixtures carry ground truth.** `fixtures/transcripts.mjs` plants facts that must appear and lists
   things that must not be asserted. `fixtures/dialogue.wav` has a known script and speakers.
6. **Log everything, including crashes.** If a harness bug, not the app, caused a result, fix the
   harness and re-run that experiment (`--only Exxx` replaces its row); note it in the report.
7. **Rounds feed rounds.** Each round's results produce the next round's hypotheses.
8. **Leave no trace.** Back up `dev.db` first; tag created records `[autoresearch]`; restore any
   setting an experiment changes.

## Running

```bash
cd autoresearch
node run.mjs --round 2 --concurrency 3      # run pending experiments in a round
node run.mjs --only E045,E049               # re-measure specific experiments
GEN_MODEL=gemini-3.6-flash node run.mjs --only E045   # A/B a different generator model
```

Each run appends to `results.tsv` and writes full evidence (outputs, judge verdicts, every API call)
to `runs/<id>.json`.
