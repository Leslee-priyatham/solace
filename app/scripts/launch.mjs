// One-click launcher used by "Start Solace" (Windows) and "Start Solace.command" (Mac/Linux).
// It installs what's needed, prepares the data folder, builds the app when the code changes, starts it
// on this computer only, and opens the browser. Built-ins only: it runs before `npm install`.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { APP, BACKUPS, DATA, DB, LOG, SETTINGS, UPLOADS, databaseUrl, readEnvFile } from "./data-dir.mjs";

const DIST = ".next-app";
const KEEP_BACKUPS = 14;
const isWin = process.platform === "win32";

const say = (msg = "") => console.log(msg);
const step = (msg) => console.log(`\n> ${msg}`);
function fail(msg, hint) {
  console.error(`\nProblem: ${msg}`);
  if (hint) console.error(`  ${hint}`);
  console.error(`\n  If this keeps happening, see "Troubleshooting" in the README, or open an issue on GitHub.`);
  process.exit(1);
}

function run(cmd, args, { env, quiet } = {}) {
  // npm is a .cmd script on Windows, so it goes through cmd.exe as one fixed command line.
  const [file, argv] = isWin && cmd === "npm" ? ["cmd.exe", ["/d", "/s", "/c", ["npm", ...args].join(" ")]] : [cmd, args];
  const r = spawnSync(file, argv, {
    cwd: APP,
    env: { ...process.env, ...env },
    stdio: quiet ? "pipe" : "inherit",
    encoding: "utf8",
  });
  return r.status === 0 ? null : (r.stderr || r.stdout || `exit code ${r.status}`).toString().slice(-2000);
}
const nodeBin = (rel) => path.join(APP, "node_modules", rel);

const mtime = (p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
function newest(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.mtimeMs;
  return Math.max(st.mtimeMs, ...fs.readdirSync(p).map((f) => newest(path.join(p, f))));
}

function freePort(start) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(freePort(start + 1)));
    s.once("listening", () => s.close(() => resolve(start)));
    s.listen(start, "127.0.0.1");
  });
}

function openBrowser(url) {
  if (process.env.SOLACE_NO_BROWSER) return;
  const [cmd, args] = isWin ? ["explorer.exe", [url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
  } catch {
    // The address is printed below; opening it by hand works too.
  }
}

// ------------------------- 1. Checks -------------------------
say("\n  Solace - starting up\n  --------------------");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Solace needs Node.js 20 or newer (this computer has ${process.versions.node}).`, "Install the LTS version from https://nodejs.org and start Solace again.");

// ------------------------- 2. Data folder -------------------------
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(BACKUPS, { recursive: true });

// The secret encrypts stored AI keys and signs logins. Losing it means re-entering AI keys, so it lives
// with the data (and is included in every backup of the data folder).
let settings = readEnvFile(SETTINGS);
if (!settings.APP_SECRET) {
  const legacy = readEnvFile(path.join(APP, ".env")).APP_SECRET;
  const secret = legacy && !legacy.startsWith("replace-with") ? legacy : randomBytes(32).toString("hex");
  fs.writeFileSync(SETTINGS, `# Solace settings. Keep this file private and include it in backups.\nAPP_SECRET="${secret}"\n`);
  settings = readEnvFile(SETTINGS);
}

// Earlier setups kept data inside the app folder: copy (never move) it into the data folder once.
const legacyDb = path.join(APP, "prisma", "dev.db");
if (!fs.existsSync(DB) && fs.existsSync(legacyDb)) {
  step("Copying your existing records into the Solace Data folder");
  fs.copyFileSync(legacyDb, DB);
  const legacyUploads = path.join(APP, "uploads");
  if (fs.existsSync(legacyUploads)) fs.cpSync(legacyUploads, UPLOADS, { recursive: true, force: false });
  say(`  Done. The originals are still in ${path.join(APP, "prisma")} - you can delete them once you're happy.`);
}

// A copy of the database at every start; the newest few are kept.
if (fs.existsSync(DB)) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  fs.copyFileSync(DB, path.join(BACKUPS, `solace-${stamp}.db`));
  const old = fs.readdirSync(BACKUPS).filter((f) => /^solace-.*\.db$/.test(f)).sort().slice(0, -KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(BACKUPS, f), { force: true });
}

const env = {
  DATABASE_URL: databaseUrl(),
  SOLACE_UPLOADS_DIR: UPLOADS,
  APP_SECRET: settings.APP_SECRET,
  SOLACE_DIST_DIR: DIST,
  NEXT_TELEMETRY_DISABLED: "1",
};

// ------------------------- 3. Install / update components -------------------------
const lock = path.join(APP, "package-lock.json");
const installed = path.join(APP, "node_modules", ".package-lock.json");
if (!fs.existsSync(installed) || mtime(lock) > mtime(installed)) {
  step("Downloading the components Solace needs (first run or after an update - a few minutes)");
  const err = run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]);
  if (err) fail("Couldn't download the components Solace needs.", "Check your internet connection, then start Solace again.");
}

// ------------------------- 4. Database -------------------------
step("Preparing your database");
{
  const err = run(process.execPath, [nodeBin("prisma/build/index.js"), "db", "push"], { env, quiet: true });
  if (err) {
    console.error(err);
    fail("Couldn't prepare the database.", `Your records are safe: a backup was just saved in ${BACKUPS}.`);
  }
}

// ------------------------- 5. Build when the code changed -------------------------
const buildId = path.join(APP, DIST, "BUILD_ID");
const sources = ["src", "public", "prisma/schema.prisma", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json"];
const changed = Math.max(...sources.map((s) => newest(path.join(APP, s))));
if (!fs.existsSync(buildId) || changed > mtime(buildId)) {
  step("Getting Solace ready (first run or after an update - usually 2-5 minutes)");
  const err = run(process.execPath, [nodeBin("next/dist/bin/next"), "build", "--no-lint"], { env });
  if (err) fail("Solace couldn't be prepared.", "Try starting it again. If you changed any files, download a fresh copy.");
}

// ------------------------- 6. Start -------------------------
const port = await freePort(Number(process.env.PORT) || 3000);
const url = `http://localhost:${port}`;
step("Starting Solace");
const log = fs.openSync(LOG, "a");
// 127.0.0.1 only: Solace is reachable from this computer, not from other devices on the network.
const server = spawn(process.execPath, [nodeBin("next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: APP,
  env: { ...process.env, ...env },
  stdio: ["ignore", log, log],
});
const stop = () => {
  server.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  if (code) {
    const tail = fs.readFileSync(LOG, "utf8").split("\n").slice(-15).join("\n");
    console.error(tail);
    fail("Solace stopped unexpectedly.", `Details are in ${LOG}`);
  }
  process.exit(0);
});

let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 500));
  ready = await fetch(`http://127.0.0.1:${port}/login`, { redirect: "manual" }).then(() => true, () => false);
}
if (!ready) fail("Solace didn't start in time.", `Details are in ${LOG}`);

openBrowser(url);
say(`
  Solace is running

    Open it at:       ${url}
    Your data is in:  ${DATA}
                      (back up this whole folder; it also keeps automatic copies in "backups")

  Keep this window open while you use Solace. Close it to stop Solace.
`);
