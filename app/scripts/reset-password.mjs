// Sets a new password for a Solace account, for when someone is locked out. Run it while Solace is closed
// (double-click "Reset password" in the Solace folder). Works on the data folder the launcher uses.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { APP, DB, databaseUrl } from "./data-dir.mjs";

function fail(msg) {
  console.error(`\nProblem: ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(APP, "node_modules", "@prisma", "client"))) fail("Start Solace once first (double-click \"Start Solace\"), then try again.");
if (!fs.existsSync(DB)) fail(`No Solace records were found at ${DB}.`);

process.env.DATABASE_URL = databaseUrl();
const require = createRequire(path.join(APP, "package.json"));
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
// Typed passwords are not shown on screen.
async function askHidden(q) {
  const write = rl._writeToOutput;
  rl._writeToOutput = (s) => rl.output.write(s.startsWith(q) ? q : "");
  const answer = await ask(q);
  rl._writeToOutput = write;
  rl.output.write("\n");
  return answer;
}

try {
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, firstName: true, lastName: true, role: true } });
  if (!users.length) fail("There are no accounts yet. Start Solace and create one.");

  console.log("\n  Solace - reset a password\n  -------------------------\n");
  users.forEach((u, i) => console.log(`  ${i + 1}. ${u.firstName} ${u.lastName} <${u.email}> (${u.role.toLowerCase()})`));
  let user = users[0];
  if (users.length > 1) {
    const pick = Number(await ask(`\n  Which account? Type its number and press Enter: `));
    user = users[pick - 1];
    if (!user) fail("That number isn't in the list.");
  }
  console.log(`\n  Setting a new password for ${user.email}`);
  const pw = await askHidden("  New password (at least 8 characters): ");
  if (pw.length < 8) fail("Use at least 8 characters.");
  if ((await askHidden("  Type it again: ")) !== pw) fail("The two passwords didn't match. Nothing was changed.");

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10), status: "ACTIVE" } });
  console.log("\n  Done: password changed. Start Solace and log in with the new password.\n");
} finally {
  rl.close();
  await db.$disconnect();
}
