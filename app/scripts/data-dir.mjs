// Where the one-click setup keeps a practice's data: outside the app folder, so replacing the app with a
// newer download never touches records. Shared by launch.mjs and reset-password.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = path.resolve(process.env.SOLACE_DATA_DIR || path.join(os.homedir(), "Solace Data"));
export const DB = path.join(DATA, "solace.db");
export const UPLOADS = path.join(DATA, "uploads");
export const SETTINGS = path.join(DATA, "settings.env");
export const BACKUPS = path.join(DATA, "backups");
export const LOG = path.join(DATA, "solace.log");
export const databaseUrl = () => `file:${DB.replace(/\\/g, "/")}`;

export function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
}
