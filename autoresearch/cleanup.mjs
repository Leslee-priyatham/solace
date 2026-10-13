// Removes records created by the experiments (tagged "[autoresearch]" or created after the run began).
import { load } from "./load.mjs";
const { db } = await load("lib/db.ts");
const storage = await load("lib/storage.ts");
const RUN_START = new Date(1791812100000); // after the user's own last assistant message
const sessions = await db.session.findMany({ where: { title: { startsWith: "[autoresearch]" } } });
for (const s of sessions) {
  await db.complianceCheck.deleteMany({ where: { noteDocument: { sessionId: s.id } } }).catch(() => {});
  await db.noteDocument.deleteMany({ where: { sessionId: s.id } });
  await db.aiConversation.updateMany({ where: { sessionId: s.id }, data: { sessionId: null } }).catch(() => {});
  await db.session.delete({ where: { id: s.id } });
  await storage.deleteUpload(s.audioPath);
}
const convs = await db.aiConversation.findMany({ where: { createdAt: { gt: RUN_START } }, select: { id: true, title: true } });
await db.aiMessage.deleteMany({ where: { conversationId: { in: convs.map((c) => c.id) } } });
await db.aiConversation.deleteMany({ where: { id: { in: convs.map((c) => c.id) } } });
const audits = await db.auditLog.deleteMany({ where: { createdAt: { gt: RUN_START }, entity: "Session" } });
console.log(`removed ${sessions.length} sessions, ${convs.length} assistant conversations (${convs.map((c) => c.title).join(" | ")}), ${audits.count} audit rows`);
console.log("remaining sessions:", (await db.session.findMany({ select: { title: true } })).map((s) => s.title));
process.exit(0);
