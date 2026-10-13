"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser, audit, hashPassword, verifyPassword } from "@/lib/auth";
import { token } from "@/lib/crypto";
import { slugify } from "@/lib/bootstrap";
import { chat } from "@/lib/ai/client";
import { buildContext, systemPrompt } from "@/lib/ai/assistant";

type R = { error?: string; ok?: boolean; link?: string; output?: string };

async function mergePrefs(userId: string, patch: Record<string, unknown>) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { preferences: { ...((u.preferences ?? {}) as object), ...patch } } });
}

async function mergePracticeSettings(patch: Record<string, unknown>) {
  const p = await db.practice.findFirstOrThrow();
  const s = (p.settings ?? {}) as Record<string, Record<string, unknown>>;
  const next: Record<string, unknown> = { ...s };
  for (const [k, v] of Object.entries(patch)) next[k] = typeof v === "object" && v && !Array.isArray(v) ? { ...(s[k] ?? {}), ...v } : v;
  await db.practice.update({ where: { id: p.id }, data: { settings: next as object } });
}

// ───────── Account ─────────

export async function saveProfile(data: { firstName: string; middleName: string; lastName: string; suffix: string; phone: string; timezone: string }): Promise<R> {
  const user = await requireUser();
  if (!data.firstName.trim() || !data.lastName.trim()) return { error: "First and last name are required." };
  await db.user.update({
    where: { id: user.id },
    data: { firstName: data.firstName.trim(), middleName: data.middleName || null, lastName: data.lastName.trim(), suffix: data.suffix || null, phone: data.phone || null, timezone: data.timezone },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(current: string, next: string): Promise<R> {
  const user = await requireUser();
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) return { error: "Your current password is incorrect." };
  if (next.length < 8) return { error: "Use at least 8 characters." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(user.id, "password", "User", user.id);
  return { ok: true };
}

export async function saveClinicalInfo(data: { npi: string; taxonomy: string; taxIdType: string; taxId: string; license: string }): Promise<R> {
  const user = await requireUser();
  if (data.npi && !/^\d{10}$/.test(data.npi.trim())) return { error: "An NPI is 10 digits." };
  await db.user.update({
    where: { id: user.id },
    data: { npi: data.npi || null, taxonomy: data.taxonomy || null, taxIdType: data.taxIdType || null, taxId: data.taxId || null, license: data.license || null },
  });
  return { ok: true };
}

export async function saveNotePrefs(data: { providerTerm: string; clientTerm: string; pronouns: string; defaultModalities: string[] }): Promise<R> {
  const user = await requireUser();
  await mergePrefs(user.id, data);
  revalidatePath("/settings/notes");
  return { ok: true };
}

export async function saveCalendarPrefs(data: { weekStartsOn: 0 | 1 }): Promise<R> {
  const user = await requireUser();
  await mergePrefs(user.id, data);
  revalidatePath("/calendar");
  return { ok: true };
}

// ───────── Assistant ─────────

export async function saveAssistantPrefs(data: { memory: boolean; guidance: string }): Promise<R> {
  const user = await requireUser();
  await mergePrefs(user.id, data);
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function addMemory(content: string): Promise<R> {
  const user = await requireUser();
  if (!content.trim()) return { error: "Write something to remember." };
  await db.assistantMemory.create({ data: { userId: user.id, content: content.trim().slice(0, 500) } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function deleteMemory(id: string): Promise<R> {
  const user = await requireUser();
  await db.assistantMemory.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function clearMemories(): Promise<R> {
  const user = await requireUser();
  await db.assistantMemory.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function saveSkill(data: { id?: string; name: string; description: string; instructions: string }): Promise<R> {
  await requireUser();
  if (!data.name.trim() || !data.instructions.trim()) return { error: "Give the skill a name and instructions." };
  const payload = { name: data.name.trim(), description: data.description.trim(), instructions: data.instructions.trim() };
  if (data.id) await db.assistantSkill.update({ where: { id: data.id }, data: payload });
  else await db.assistantSkill.create({ data: payload });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function deleteSkill(id: string): Promise<R> {
  await requireUser();
  await db.assistantSkill.delete({ where: { id } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function saveRoutine(data: { id?: string; name: string; description: string; prompt: string; trigger: string; timeOfDay: string; enabled: boolean }): Promise<R> {
  await requireUser();
  if (!data.name.trim() || !data.prompt.trim()) return { error: "Give the routine a name and instructions." };
  const payload = { name: data.name.trim(), description: data.description || null, prompt: data.prompt.trim(), trigger: data.trigger, timeOfDay: data.trigger === "DAILY" ? data.timeOfDay || "08:00" : null, enabled: data.enabled };
  if (data.id) await db.assistantRoutine.update({ where: { id: data.id }, data: payload });
  else await db.assistantRoutine.create({ data: payload });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function toggleRoutine(id: string, enabled: boolean): Promise<R> {
  await requireUser();
  await db.assistantRoutine.update({ where: { id }, data: { enabled } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

export async function deleteRoutine(id: string): Promise<R> {
  await requireUser();
  await db.assistantRoutine.delete({ where: { id } });
  revalidatePath("/settings/assistant");
  return { ok: true };
}

/** Runs a routine now and stores the output as an assistant chat. */
export async function runRoutineNow(id: string): Promise<R> {
  const user = await requireUser();
  const routine = await db.assistantRoutine.findUniqueOrThrow({ where: { id } });
  try {
    const [system, context] = await Promise.all([systemPrompt(user.id), buildContext(user.id, {})]);
    const output = await chat({ system, messages: [{ role: "user", content: `<record>\n${context}\n</record>\n\n${routine.prompt}` }], maxTokens: 4000 });
    const conv = await db.aiConversation.create({ data: { userId: user.id, title: `${routine.name} · ${new Date().toLocaleDateString()}`, routineId: routine.id } });
    await db.aiMessage.createMany({ data: [{ conversationId: conv.id, role: "user", content: routine.prompt }, { conversationId: conv.id, role: "assistant", content: output }] });
    await db.assistantRoutine.update({ where: { id }, data: { lastRunAt: new Date() } });
    revalidatePath("/settings/assistant");
    return { ok: true, output };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Routine failed" };
  }
}

// ───────── Practice ─────────

export async function savePracticeDetails(data: { name: string; displayName: string; email: string; phone: string; country: string; currency: string; timezone: string; address: string; taxId: string }): Promise<R> {
  const user = await requireAdmin();
  if (!data.name.trim()) return { error: "Practice name is required." };
  const p = await db.practice.findFirstOrThrow();
  await db.practice.update({
    where: { id: p.id },
    data: {
      name: data.name.trim(),
      displayName: data.displayName || null,
      email: data.email || null,
      phone: data.phone || null,
      country: data.country,
      currency: data.currency || "USD",
      timezone: data.timezone,
      address: data.address || null,
      taxId: data.taxId || null,
    },
  });
  await audit(user.id, "update", "Practice", p.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveBranding(data: { brandColor: string; logoUrl: string; slug: string }): Promise<R> {
  await requireAdmin();
  const p = await db.practice.findFirstOrThrow();
  const slug = slugify(data.slug || p.slug);
  const clash = await db.practice.findFirst({ where: { slug, NOT: { id: p.id } } });
  if (clash) return { error: "That booking address is taken." };
  if (!/^#[0-9a-fA-F]{6}$/.test(data.brandColor)) return { error: "Use a hex colour like #0a8c76." };
  await db.practice.update({ where: { id: p.id }, data: { brandColor: data.brandColor, logoUrl: data.logoUrl || null, slug } });
  revalidatePath("/settings/practice");
  return { ok: true };
}

export async function saveLocation(data: { id?: string; name: string; kind: string; address: string; placeOfService: string }): Promise<R> {
  await requireAdmin();
  if (!data.name.trim()) return { error: "Name the location." };
  const payload = { name: data.name.trim(), kind: data.kind, address: data.address || null, placeOfService: data.placeOfService };
  if (data.id) await db.location.update({ where: { id: data.id }, data: payload });
  else await db.location.create({ data: payload });
  revalidatePath("/settings/practice");
  return { ok: true };
}

export async function deleteLocation(id: string): Promise<R> {
  await requireAdmin();
  await db.location.delete({ where: { id } });
  revalidatePath("/settings/practice");
  return { ok: true };
}

export async function savePortalSettings(data: { selfScheduling: boolean; autoConfirm: boolean; hidePrices: boolean; messaging: boolean }): Promise<R> {
  await requireAdmin();
  await mergePracticeSettings({ portal: data });
  revalidatePath("/settings/portal");
  return { ok: true };
}

export async function saveReminderSettings(data: { enabled: boolean; channels: string[]; first: number; second: number | null; formReminderDays: number | null }): Promise<R> {
  await requireAdmin();
  await mergePracticeSettings({ reminders: data });
  revalidatePath("/settings/reminders");
  return { ok: true };
}

export async function saveBillingSettings(data: { invoiceDueDays: number; lateCancelFeeCents: number; paymentInstructions: string; invoiceFooter: string }): Promise<R> {
  await requireAdmin();
  await mergePracticeSettings({ billing: data });
  revalidatePath("/settings/billing");
  return { ok: true };
}

export async function saveMessagingName(name: string): Promise<R> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { messagingName: name.trim() || null } });
  revalidatePath("/settings/messaging");
  return { ok: true };
}

// ───────── Services & availability ─────────

export async function saveService(data: { id?: string; name: string; cpt: string; description: string; durationMin: number; rateCents: number; selfSchedule: boolean }): Promise<R> {
  await requireAdmin();
  if (!data.name.trim()) return { error: "Name the service." };
  if (data.durationMin < 5) return { error: "Duration must be at least 5 minutes." };
  const payload = { name: data.name.trim(), cpt: data.cpt || null, description: data.description || null, durationMin: data.durationMin, rateCents: data.rateCents, selfSchedule: data.selfSchedule };
  if (data.id) await db.service.update({ where: { id: data.id }, data: payload });
  else await db.service.create({ data: { ...payload, sortOrder: await db.service.count() } });
  revalidatePath("/settings/services");
  return { ok: true };
}

export async function archiveService(id: string, archived: boolean): Promise<R> {
  await requireAdmin();
  await db.service.update({ where: { id }, data: { archived } });
  revalidatePath("/settings/services");
  return { ok: true };
}

export async function saveAvailability(rules: { weekday: number; startMin: number; endMin: number }[]): Promise<R> {
  const user = await requireUser();
  for (const r of rules) if (r.endMin <= r.startMin) return { error: "Each block must end after it starts." };
  await db.availabilityRule.deleteMany({ where: { userId: user.id } });
  await db.availabilityRule.createMany({ data: rules.map((r) => ({ ...r, userId: user.id })) });
  revalidatePath("/settings/availability");
  return { ok: true };
}

// ───────── Calendars ─────────

export async function addExternalCalendar(data: { name: string; icsUrl: string; color: string }): Promise<R> {
  await requireUser();
  if (!/^(https?|webcal):\/\//.test(data.icsUrl.trim())) return { error: "Paste the calendar's secret iCal (.ics) address." };
  await db.externalCalendar.create({ data: { name: data.name.trim() || "External calendar", icsUrl: data.icsUrl.trim(), color: data.color } });
  const { syncExternalCalendars } = await import("../calendar/actions");
  await syncExternalCalendars();
  revalidatePath("/settings/calendars");
  return { ok: true };
}

export async function removeExternalCalendar(id: string): Promise<R> {
  await requireUser();
  await db.externalCalendar.delete({ where: { id } });
  revalidatePath("/settings/calendars");
  return { ok: true };
}

export async function resetIcalToken(): Promise<R> {
  const user = await requireUser();
  await mergePrefs(user.id, { icalToken: token(18) });
  revalidatePath("/settings/calendars");
  return { ok: true };
}

export async function disableIcalFeed(): Promise<R> {
  const user = await requireUser();
  await mergePrefs(user.id, { icalToken: null });
  revalidatePath("/settings/calendars");
  return { ok: true };
}

// ───────── Team ─────────

export async function inviteMember(data: { firstName: string; lastName: string; email: string; role: string }): Promise<R> {
  const admin = await requireAdmin();
  const email = data.email.trim().toLowerCase();
  if (!data.firstName.trim() || !data.lastName.trim() || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a name and a valid email." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Someone with that email is already on the team." };
  const inviteToken = token(24);
  await db.user.create({
    data: {
      email,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role: data.role,
      status: "INVITED",
      inviteToken,
      telehealthSlug: `${slugify(`${data.firstName}-${data.lastName}`)}-${token(3).toLowerCase()}`,
      preferences: { providerTerm: "Therapist", clientTerm: "Client" },
    },
  });
  await audit(admin.id, "invite", "User", undefined, email);
  revalidatePath("/settings/team");
  return { ok: true, link: `/invite/${inviteToken}` };
}

export async function updateMember(id: string, data: { role?: string; status?: string }): Promise<R> {
  const admin = await requireAdmin();
  if (id === admin.id && data.role && data.role !== "ADMIN") return { error: "You can't remove your own admin role." };
  if (id === admin.id && data.status === "DISABLED") return { error: "You can't deactivate yourself." };
  await db.user.update({ where: { id }, data });
  await audit(admin.id, "update", "User", id, JSON.stringify(data));
  revalidatePath("/settings/team");
  return { ok: true };
}

export async function regenerateInvite(id: string): Promise<R> {
  await requireAdmin();
  const inviteToken = token(24);
  await db.user.update({ where: { id }, data: { inviteToken, status: "INVITED" } });
  revalidatePath("/settings/team");
  return { ok: true, link: `/invite/${inviteToken}` };
}
