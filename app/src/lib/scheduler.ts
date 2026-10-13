import "server-only";
import { db } from "./db";
import { chat, isConfigured } from "./ai/client";
import { buildContext, systemPrompt } from "./ai/assistant";
import { time } from "./format";

// In-process background jobs (started from instrumentation.ts). Each job records what it has
// already handled in the Setting table so restarts never repeat work.

async function doneSet(key: string) {
  const s = await db.setting.findUnique({ where: { key } });
  return new Set((s?.value ?? []) as string[]);
}

async function saveDone(key: string, set: Set<string>) {
  const value = [...set].slice(-500);
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Appointment reminders, delivered to the client's secure inbox / portal. */
async function sendReminders() {
  const p = await db.practice.findFirst();
  const r = ((p?.settings ?? {}) as { reminders?: { enabled?: boolean; first?: number; second?: number | null } }).reminders;
  if (!r?.enabled) return;
  const sent = await doneSet("jobs.reminders");
  const stages = [r.first, r.second].filter((h): h is number => typeof h === "number" && h > 0);
  for (const [i, hours] of stages.entries()) {
    const upcoming = await db.appointment.findMany({
      where: { kind: "SESSION", status: "SCHEDULED", clientId: { not: null }, startsAt: { gt: new Date(), lte: new Date(Date.now() + hours * 3600e3) } },
      include: { client: true, provider: true },
    });
    for (const a of upcoming) {
      const key = `${a.id}:${i}`;
      if (sent.has(key) || !a.client?.remindersOn) continue;
      let conv = await db.conversation.findFirst({ where: { clientId: a.clientId!, archived: false } });
      if (!conv) conv = await db.conversation.create({ data: { clientId: a.clientId! } });
      const when = `${a.startsAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} at ${time(a.startsAt)}`;
      await db.message.create({
        data: {
          conversationId: conv.id,
          sender: "PROVIDER",
          authorName: p?.displayName || p?.name || "Your practice",
          body: `Reminder: you have a session with ${a.provider.firstName} ${a.provider.lastName} on ${when}.${a.modality === "TELEHEALTH" ? " Join the video call from your client portal." : ""}`,
        },
      });
      await db.conversation.update({ where: { id: conv.id }, data: { clientUnread: { increment: 1 }, lastMessageAt: new Date() } });
      sent.add(key);
    }
  }
  await saveDone("jobs.reminders", sent);
}

async function runRoutine(routineId: string, prompt: string, title: string, providerId: string, ctx: { clientId?: string | null; sessionId?: string | null }) {
  const [system, context] = await Promise.all([systemPrompt(providerId), buildContext(providerId, { ...ctx })]);
  const output = await chat({ system, messages: [{ role: "user", content: `<record>\n${context}\n</record>\n\n${prompt}` }], maxTokens: 4000 });
  const conv = await db.aiConversation.create({ data: { userId: providerId, title, routineId, clientId: ctx.clientId ?? null, sessionId: ctx.sessionId ?? null } });
  await db.aiMessage.createMany({ data: [{ conversationId: conv.id, role: "user", content: prompt }, { conversationId: conv.id, role: "assistant", content: output }] });
  await db.assistantRoutine.update({ where: { id: routineId }, data: { lastRunAt: new Date() } });
}

async function runRoutines() {
  if (!(await isConfigured("text"))) return;
  const routines = await db.assistantRoutine.findMany({ where: { enabled: true } });
  if (!routines.length) return;
  const users = await db.user.findMany({ where: { status: "ACTIVE", role: { not: "BILLER" } } });
  const now = new Date();
  for (const r of routines) {
    const done = await doneSet(`jobs.routine.${r.id}`);
    if (r.trigger === "DAILY" && r.timeOfDay) {
      const [h, m] = r.timeOfDay.split(":").map(Number);
      const due = new Date(now);
      due.setHours(h, m, 0, 0);
      const key = due.toISOString().slice(0, 10);
      if (now >= due && !done.has(key)) {
        for (const u of users) await runRoutine(r.id, r.prompt, `${r.name} · ${now.toLocaleDateString()}`, u.id, {}).catch((e) => console.error("[routine]", e));
        done.add(key);
      }
    } else if (r.trigger === "BEFORE_SESSION") {
      const soon = await db.appointment.findMany({
        where: { kind: "SESSION", status: "SCHEDULED", clientId: { not: null }, startsAt: { gt: now, lte: new Date(now.getTime() + 60 * 60e3) } },
      });
      for (const a of soon) {
        if (done.has(a.id)) continue;
        await runRoutine(r.id, r.prompt, `${r.name} · ${a.startsAt.toLocaleString()}`, a.providerId, { clientId: a.clientId }).catch((e) => console.error("[routine]", e));
        done.add(a.id);
      }
    } else if (r.trigger === "AFTER_SESSION") {
      const recent = await db.session.findMany({ where: { status: "READY", clientId: { not: null }, updatedAt: { gte: new Date(now.getTime() - 6 * 3600e3) } } });
      for (const s of recent) {
        if (done.has(s.id)) continue;
        await runRoutine(r.id, r.prompt, `${r.name} · ${s.title ?? "session"}`, s.providerId, { clientId: s.clientId, sessionId: s.id }).catch((e) => console.error("[routine]", e));
        done.add(s.id);
      }
    }
    await saveDone(`jobs.routine.${r.id}`, done);
  }
}

let running = false;

export async function tick() {
  if (running) return;
  running = true;
  try {
    await sendReminders();
    await runRoutines();
  } catch (e) {
    console.error("[scheduler]", e);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  const g = globalThis as unknown as { __solaceScheduler?: NodeJS.Timeout };
  if (g.__solaceScheduler) return;
  g.__solaceScheduler = setInterval(tick, 60_000);
  setTimeout(tick, 15_000);
}
