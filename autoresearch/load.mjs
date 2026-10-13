// Loads Solace's real server modules (TypeScript, "@/..." aliases) outside Next.js.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP = path.resolve(here, "../app");
export const HERE = here;
process.chdir(APP); // prisma resolves file:./dev.db relative to the schema; .env lives here
process.loadEnvFile(path.join(APP, ".env"));

export const appRequire = createRequire(path.join(APP, "package.json"));
const { createJiti } = appRequire("jiti");

export const jiti = createJiti(path.join(APP, "package.json"), {
  alias: { "@": path.join(APP, "src"), "server-only": path.join(here, "empty.mjs") },
  interopDefault: true,
  moduleCache: true,
});
export const load = (p) => jiti.import(path.join(APP, "src", p));
