# Solace

**Free, open-source practice management and AI note-writing for therapists.** Solace runs on your own
computer. Your records stay in a folder on your machine, and it works with an AI service you choose
(including a free option).

- **Session notes, written for you:** record a session (or upload a recording, or jot a quick summary)
  and get a draft note in your format: SOAP, DAP, BIRP, GIRP, intake, discharge and more.
- **Clients:** caseload, diagnoses, treatment plans, PHQ-9 / GAD-7 tracking, chart notes and files.
- **Calendar**, **invoices and payments**, **superbills**, **insurance claims** (simulated), **intake and
  consent forms**, and an **AI assistant** that can prepare you for your next session.

> Solace is a tool to help you write documentation. It is **not** a certified medical device. Always
> review AI-written notes before signing them, and check your professional and legal obligations (for
> example HIPAA in the US) before using it with real client information.

---

## Install it (about 10 minutes, no technical knowledge needed)

### 1. Install Node.js (one time only)

Solace needs a free program called Node.js to run.

1. Go to **[nodejs.org/en/download](https://nodejs.org/en/download)**.
2. Download the **LTS** version for your computer (Windows or Mac).
3. Open the downloaded file and click through the installer, accepting the default options.

### 2. Download Solace

1. At the top of this page, click the green **Code** button, then **Download ZIP**.
2. Unzip it:
   - **Windows:** right-click the downloaded file → **Extract All…** → **Extract**.
   - **Mac:** double-click the downloaded file.
3. You now have a folder called something like `solace-main`. Move it somewhere permanent, such as your
   **Documents** folder.

### 3. Start Solace

Open that folder and double-click:

- **Windows:** `Start Solace` (it may show as `Start Solace.bat`)
- **Mac:** `Start Solace.command`

A window with text opens. **The first start takes about 5 minutes** while Solace downloads what it needs
and gets ready. Later starts take a few seconds. When it's ready, Solace opens in your web browser.

**If your computer shows a security warning** (this is normal for free software downloaded from the internet):

- **Windows** ("Windows protected your PC"): click **More info** → **Run anyway**.
- **Mac** ("cannot be opened because it is from an unidentified developer"): close the message, then
  **right-click** (or Control-click) `Start Solace.command` → **Open** → **Open**. You only need to do
  this once.

### 4. Create your account

The first time Solace opens, it asks you to **Set up your practice**. The account you create here is
your login. A sample client ("Jordan Rivera (demo)") is added so you can explore every screen; you can
delete it later.

> Choose a password you'll remember. Solace runs on your computer and doesn't send email, so there's
> no "forgot password" link. If you do get locked out, see **Troubleshooting** below.

### 5. Connect an AI service

Solace writes notes using an AI service of your choice. You bring your own key; nothing is shared with
the Solace project.

**The free option, Google Gemini:**

1. Go to **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)** and sign in with a Google account.
2. Click **Create API key** and copy it.
3. In Solace, open **Settings → AI providers → Add provider**, choose **Google Gemini**, paste the key and
   save. Solace picks good models automatically: `gemini-3.5-flash-lite` for writing and
   `gemini-3.5-transcribe` for recordings.

The free Gemini tier has daily limits. For heavier use, add billing in Google AI Studio, or use another
provider: Solace also supports **Anthropic (Claude)**, **OpenAI**, **Deepgram**, **AssemblyAI**, and
private models that run on your own computer (**Ollama**, **LM Studio**).

> **Client privacy:** session text and audio are sent to the AI service you connect. For real client
> information, use a provider that will sign a Business Associate Agreement (or your country's
> equivalent), or a private model on your own computer.

---

## Everyday use

- **Start:** double-click `Start Solace`. Your browser opens at **http://localhost:3000**, which you can bookmark.
- **Stop:** close the Solace window (the one with text in it).
- **Keep the window open** while you use Solace. It can be minimised.

## Your data and backups

Everything you enter is kept in a folder called **Solace Data** in your home folder:

- **Windows:** `C:\Users\<your name>\Solace Data`
- **Mac:** `/Users/<your name>/Solace Data`

It contains your records (`solace.db`), uploaded recordings and files (`uploads`), a private settings
file, and **automatic backups**: Solace saves a copy of your records every time it starts and keeps the
latest 14 in the `backups` folder.

**Back up the whole Solace Data folder regularly**, for example to an encrypted external drive. To move
to a new computer, install Solace there and copy the Solace Data folder into your home folder before the
first start.

## Updating Solace

1. Download the newest ZIP from this page, as in step 2.
2. Delete your old Solace folder and put the new one in its place. **Your records are not affected**:
   they live in the separate Solace Data folder.
3. Double-click `Start Solace`. The first start after an update takes a few minutes again.

## What works on your own computer

Solace runs privately on your computer: nobody else on your network or the internet can reach it. Note
writing, recordings, clients, calendar, billing, forms and the assistant all work. Clients can fill in
forms on your screen during a session ("Fill in with client now").

Features where **clients use their own device**, such as the client portal link, online booking, emailed
form links and video sessions with remote clients, need Solace to be hosted on a server that clients can
reach. That is a technical setup; see the [developer guide](app/README.md).

## Troubleshooting

| Problem | What to do |
|---|---|
| "Solace needs Node.js" after you installed it | Restart your computer, then start Solace again. |
| "Couldn't download the components Solace needs" | Check your internet connection and start Solace again. Work or clinic networks sometimes block downloads; try from home. |
| Forgot your password | Close Solace, then double-click `Reset password` in the Solace folder (`Reset password.command` on a Mac) and follow the prompts. |
| The browser didn't open | Open your browser and go to the address shown in the Solace window (usually http://localhost:3000). |
| A note says the AI service is busy or its quota is used up | Wait a while, or choose another model in **Settings → AI providers**. Free tiers have daily limits. |
| Something else went wrong | The Solace window says what happened. More detail is in `Solace Data/solace.log`. You can open an issue on this GitHub page (never include client information). |

---

## For developers

The application lives in [`app/`](app) (Next.js 15, SQLite via Prisma, TypeScript). See the
[developer guide](app/README.md) for running it in development mode, the project layout and the AI
provider layer. [`autoresearch/`](autoresearch) holds a functional test harness in the style of
[karpathy/autoresearch](https://github.com/karpathy/autoresearch): 115 small, scored experiments that
exercise the real modules and HTTP API. Start with its [report](autoresearch/REPORT.md).

## License

[MIT](LICENSE). Free to use, change and share.
