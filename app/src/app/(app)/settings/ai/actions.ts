"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, audit } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { PROVIDERS, type ProviderKind, type Purpose } from "@/lib/ai/catalog";
import { chat, listModels, providerFromRow } from "@/lib/ai/client";

type Result = { error?: string; ok?: boolean; models?: string[]; reply?: string };

export async function saveProvider(input: { id?: string; kind: ProviderKind; label: string; baseUrl?: string; apiKey?: string; model?: string }): Promise<Result> {
  const user = await requireUser();
  const info = PROVIDERS[input.kind];
  if (!info) return { error: "Unknown provider" };
  if (info.baseUrlEditable && !input.baseUrl?.trim()) return { error: "Enter the API base URL (for example https://openrouter.ai/api/v1)." };
  if (!input.id && info.keyRequired && !input.apiKey?.trim()) return { error: "Paste an API key." };

  const data = {
    kind: input.kind,
    label: input.label.trim() || info.label,
    baseUrl: info.baseUrlEditable ? input.baseUrl?.trim().replace(/\/+$/, "") : null,
    model: input.model?.trim() || null,
    ...(input.apiKey?.trim() ? { apiKeyEnc: encrypt(input.apiKey.trim()) } : {}),
  };
  const row = input.id ? await db.aiProvider.update({ where: { id: input.id }, data }) : await db.aiProvider.create({ data });

  // The first provider able to do a job becomes its default. OpenAI-compatible endpoints are not
  // auto-assigned to transcription because many of them don't serve /audio/transcriptions.
  for (const purpose of info.purposes) {
    if (purpose === "transcription" && input.kind === "openai_compatible") continue;
    if (await db.setting.findUnique({ where: { key: `ai.${purpose}` } })) continue;
    const model = purpose === "transcription" ? info.suggestedTranscriptionModel ?? (input.kind === "gemini" ? row.model : null) : row.model;
    await db.setting.create({ data: { key: `ai.${purpose}`, value: { providerId: row.id, model: model ?? undefined } } });
  }
  await audit(user.id, input.id ? "update" : "create", "AiProvider", row.id, row.label);
  revalidatePath("/settings/ai");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProvider(id: string): Promise<Result> {
  const user = await requireUser();
  await db.aiProvider.delete({ where: { id } });
  for (const purpose of ["text", "transcription"] as Purpose[]) {
    const s = await db.setting.findUnique({ where: { key: `ai.${purpose}` } });
    if ((s?.value as { providerId?: string } | null)?.providerId === id) await db.setting.delete({ where: { key: `ai.${purpose}` } });
  }
  await audit(user.id, "delete", "AiProvider", id);
  revalidatePath("/settings/ai");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function assignPurpose(purpose: Purpose, providerId: string, model: string): Promise<Result> {
  await requireUser();
  if (!providerId) {
    await db.setting.deleteMany({ where: { key: `ai.${purpose}` } });
  } else {
    const p = await db.aiProvider.findUnique({ where: { id: providerId } });
    if (!p) return { error: "Provider not found" };
    if (!PROVIDERS[p.kind as ProviderKind].purposes.includes(purpose)) return { error: `${p.label} can't be used for ${purpose}.` };
    await db.setting.upsert({
      where: { key: `ai.${purpose}` },
      create: { key: `ai.${purpose}`, value: { providerId, model: model.trim() || undefined } },
      update: { value: { providerId, model: model.trim() || undefined } },
    });
  }
  revalidatePath("/settings/ai");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Checks the key by listing models; for draft (unsaved) values pass kind/baseUrl/apiKey directly. */
export async function testProvider(input: { id?: string; kind: ProviderKind; baseUrl?: string; apiKey?: string; model?: string }): Promise<Result> {
  await requireUser();
  try {
    const saved = input.id ? await db.aiProvider.findUnique({ where: { id: input.id } }) : null;
    const resolved = providerFromRow({
      id: input.id ?? "draft",
      kind: input.kind,
      label: PROVIDERS[input.kind].label,
      baseUrl: input.baseUrl?.trim() || saved?.baseUrl || null,
      apiKeyEnc: input.apiKey?.trim() ? encrypt(input.apiKey.trim()) : saved?.apiKeyEnc ?? null,
      model: input.model || saved?.model || null,
    });
    const models = await listModels(resolved);
    return { ok: true, models };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Connection failed" };
  }
}

/** Sends a one-line prompt through the configured writing model. */
export async function pingWriting(): Promise<Result> {
  await requireUser();
  try {
    const reply = await chat({ messages: [{ role: "user", content: "Reply with exactly: Connection works." }], maxTokens: 50 });
    return { ok: true, reply };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Request failed" };
  }
}
