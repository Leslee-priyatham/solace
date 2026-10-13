# Solace

Open-source practice management and AI documentation for therapists. This file is the developer guide;
if you just want to use Solace, follow the [step-by-step guide](../README.md) instead.

It runs locally on Next.js + SQLite and works with **any AI provider you bring a key for**.

## Quick start

```bash
cd app
npm install
cp .env.example .env        # then set APP_SECRET (the file shows how to generate one)
npx prisma db push
npm run dev                 # http://localhost:3000
```

The first visit opens **Set up your practice**. The account you create is the admin; a demo client
("Jordan Rivera (demo)") with a sample session, note and treatment plan is added so every screen has
something to show. Then open **Settings → AI providers**.

## AI providers (bring your own key)

Add as many providers as you like, then choose one for **writing** and one for **transcription**.
Keys are encrypted at rest with `APP_SECRET`. "Test & load models" checks the key and lists the
models it can use.

| Provider | Writing | Transcription | Notes |
|---|---|---|---|
| Anthropic (Claude) | ✓ | | Official SDK. Default model `claude-opus-5-5`; refusal fallback enabled on current Claude models. |
| OpenAI | ✓ | ✓ | GPT models; Whisper / GPT-4o transcription. |
| Google Gemini | ✓ | ✓ | Defaults: `gemini-3.5-flash-lite` for writing, `gemini-3.5-transcribe` for audio (native speaker labels and word timestamps; recordings up to ~18 MB). |
| OpenAI-compatible | ✓ | ✓* | OpenRouter, Groq, Mistral, DeepSeek, Together, xAI, Ollama, LM Studio, vLLM… *if the endpoint serves `/audio/transcriptions` (e.g. Groq). |
| Deepgram | | ✓ | Built-in speaker separation. |
| AssemblyAI | | ✓ | Speaker labels. |

When a transcription provider doesn't separate speakers, the writing model labels clinician/client turns.

## What's included

- **Session capture** — record in-person sessions or virtual calls (tab audio + mic) in the browser,
  upload recordings, or write/dictate a summary. Pipeline: transcribe → label speakers → title,
  synopsis and chapters → note(s) in your templates.
- **Session notes** — tabbed documents per session, rich-text editing with autosave, per-section
  rating / regenerate / copy, *Edit with Assistant*, sign & unsign (audited), compliance check,
  transcript drawer with chapters, audio sync and search, talk-time analytics, billing panel.
- **Clients** — caseload with status/tag filters, couples & families, ICD-10 diagnoses, contacts,
  note preferences, and tabs for sessions, AI treatment summary (shareable to the portal), treatment
  plan (AI-generated, editable), forms, PHQ-9/GAD-7 insights, chart notes, files and billing.
- **Calendar** — day/week/month, recurring appointments, time off, statuses with late-cancel fees,
  external calendars via iCal, private iCal feed, online booking with availability.
- **Note templates** — 11 built-in formats (SOAP, DAP, BIRP, GIRP, PIRP, EMDR, couples, intake,
  discharge, client recap, standard progress), custom templates, PDF → template, live preview against a
  real session, per-user and per-client defaults.
- **Practice forms** — form builder, library (intake, consent, ROI, SMS consent, PHQ-9, GAD-7),
  packets, PDF → form, send to clients, public fill-in with autosave, automatic scoring into Insights.
- **Messaging** — secure two-way inbox with attachments, archive, block, bulk announcements.
- **Client portal** — private link per client: sessions (join video, cancel), forms, messages,
  invoices, superbills, shared summary, booking.
- **Payments** — invoices from sessions, payments with automatic allocation, refunds, credit,
  unbilled sessions, superbills, statements, analytics.
- **Insurance** — payers, billing profiles, enrollments, policies, eligibility, prior auths, claims
  (edit, readiness checks, submit, adjudicate, corrected claims), payer payments / ERAs, patient
  responsibility invoicing.
- **Telehealth** — browser-to-browser video (WebRTC) with screen share; the clinician room records both
  voices and turns the call into a note.
- **Assistant** — streaming chat with client/session/practice context, quick actions, memory, skills,
  and routines that run daily or before/after sessions.
- **Reports** — configurable dashboards (sessions, caseload, sign-off time, revenue, balances,
  outcomes, measures, new clients).
- **Compliance checker** — check notes (or uploaded PDFs) against payer criteria groups; optional
  automatic checks on every new note.
- **Admin** — team invites and roles, practice details & branding, locations, services, reminders,
  sessions overview with CSV export, CSV client import, audit log.

## Simulated / not connected

These need a contract or account with an outside service, so they work end-to-end locally but don't
reach the real network:

- **Insurance clearinghouse** — claim submission, payer responses and ERAs are simulated from the claim
  page (clearly labelled). Swap in a clearinghouse API in `src/app/(app)/insurance/actions.ts`.
- **Eligibility** — returns a summary built from the policy on file, marked "simulated".
- **Card processing** — payments are recorded manually (card terminal, transfer, cash…).
- **Email / SMS** — reminders and notifications are delivered to the client's secure portal inbox.
- **Telehealth relay** — uses public STUN only; very restrictive networks may need a TURN server.

## Data & privacy

Everything is stored in `prisma/dev.db` and `uploads/` on this machine. Clinical text is sent only to
the AI providers you configure — for real client data use providers that will sign a BAA (or your local
equivalent) or run a local model via Ollama / LM Studio. This is a working rebuild, not a certified
medical product; review your legal obligations before using it with real clients.

## Project layout

```
prisma/schema.prisma        data model (50 models)
src/lib/ai/                 provider-agnostic client, transcription, clinical prompts, assistant
src/lib/sessions.ts         capture → transcript → note pipeline
src/lib/scheduler.ts        reminders and assistant routines (started from instrumentation.ts)
src/app/(app)/              signed-in app (home, calendar, sessions, clients, billing, insurance, …)
src/app/portal, f, book, join   client-facing pages (portal, forms, booking, telehealth)
```
