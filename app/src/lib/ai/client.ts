import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { PROVIDERS, type ProviderKind, type Purpose } from "./catalog";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system?: string;
  messages: ChatMessage[];
  /** Ask for a JSON object back (best effort on every provider; always parsed defensively). */
  json?: boolean;
  maxTokens?: number;
  /** Override the configured model for this call. */
  model?: string;
}

export interface ResolvedProvider {
  id: string;
  kind: ProviderKind;
  label: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
}

export class AiNotConfiguredError extends Error {
  constructor(purpose: Purpose) {
    super(
      purpose === "text"
        ? "No AI model is set up for writing yet. Add a provider and API key in Settings → AI providers."
        : "No transcription provider is set up yet. Add one in Settings → AI providers.",
    );
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  status: number | string;
  /** The provider's own message, for logs. `message` is written for clinicians. */
  detail: string;
  constructor(provider: string, status: number | string, detail: string) {
    const inner = providerMessage(detail);
    super(friendlyMessage(provider, status, inner));
    this.name = "AiRequestError";
    this.status = status;
    this.detail = inner;
  }
}

/** Pulls the human-readable message out of a provider's JSON error body. */
function providerMessage(detail: string) {
  try {
    const j = JSON.parse(detail);
    const m = j?.error?.message ?? j?.message ?? j?.error;
    if (typeof m === "string") return m;
  } catch {
    const m = detail.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) return m[1].replace(/\\n/g, " ");
  }
  return detail;
}

/** Seconds the provider asked us to wait ("retry in 9h57m26s", "retryDelay": "40s"), if stated. */
function retryHintSeconds(detail: string) {
  const m = detail.match(/retry in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i) ?? detail.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
  if (!m) return undefined;
  return m.length === 4 ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]) : Number(m[1]);
}

function isQuotaExhausted(detail: string) {
  return /quota|resource_exhausted|billing/i.test(detail) && (retryHintSeconds(detail) ?? 0) > 60;
}

function friendlyMessage(provider: string, status: number | string, detail: string) {
  const short = detail.replace(/\s+/g, " ").trim().slice(0, 200);
  if (status === 429 && isQuotaExhausted(detail)) {
    const wait = retryHintSeconds(detail)!;
    const when = wait >= 3600 ? `${Math.round(wait / 3600)} h` : `${Math.ceil(wait / 60)} min`;
    return `${provider}: the usage quota for this model is used up (resets in about ${when}). Choose another model in Settings → AI providers, or add billing to your API key. (429)`;
  }
  if (status === 429) return `${provider} is rate-limiting requests. Wait a minute and try again. (429)`;
  if (status === 500 || status === 502 || status === 503 || status === 504 || status === 529) {
    return `${provider} is temporarily overloaded or unavailable. Please try again in a few minutes. (${status})`;
  }
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(detail))) {
    return `${provider} rejected the API key. Check it in Settings → AI providers. (${status}: ${short})`;
  }
  if (status === 404) return `${provider} couldn't find that model. Choose another in Settings → AI providers. (404: ${short})`;
  if (status === "timeout") return `${provider} didn't respond in time. Please try again. (${short})`;
  if (status === "network") return `Couldn't reach ${provider}. Check the internet connection and try again. (${short})`;
  return `${provider} returned ${status}: ${short}`;
}

// ───────────────────────── Resilient fetch ─────────────────────────

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch for provider APIs: a timeout until the response headers arrive, and up to `attempts` tries with
 * backoff for overload/rate-limit/network errors. A quota that resets later than a short wait is not
 * retried. Returns only OK responses; anything else becomes an AiRequestError.
 */
export async function providerFetch(
  label: string,
  url: string,
  init: RequestInit,
  { timeoutMs = 60_000, attempts = 3 }: { timeoutMs?: number; attempts?: number } = {},
): Promise<Response> {
  const backoff = (attempt: number) => 1000 * 3 ** (attempt - 1) + Math.random() * 300; // ~1s, 3s, 9s
  let last: AiRequestError | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      const timedOut = ctrl.signal.aborted;
      last = timedOut
        ? new AiRequestError(label, "timeout", `No response after ${Math.round(timeoutMs / 1000)}s.`)
        : new AiRequestError(label, "network", e instanceof Error ? e.message : String(e));
      // An unresponsive provider already cost a full timeout; try it at most once more.
      if (timedOut && attempt >= 2) throw last;
      if (attempt < attempts) await sleep(backoff(attempt));
      continue;
    }
    clearTimeout(timer);
    if (res.ok) return res;

    const body = await res.text().catch(() => "");
    last = new AiRequestError(label, res.status, body);
    if (!RETRYABLE.has(res.status)) throw last;
    const header = Number(res.headers.get("retry-after"));
    const hint = retryHintSeconds(body) ?? (Number.isFinite(header) && header > 0 ? header : undefined);
    if (hint !== undefined && hint > 20) throw last; // e.g. a daily quota — retrying now can't succeed
    if (attempt < attempts) await sleep(Math.max(backoff(attempt), (hint ?? 0) * 1000));
  }
  throw last!;
}

/** Reads a response body, giving up if it stalls. */
export async function readText(res: Response, label: string, timeoutMs = 120_000) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      res.text(),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new AiRequestError(label, "timeout", `The response stalled for ${Math.round(timeoutMs / 1000)}s.`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Claude models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export async function resolveProvider(purpose: Purpose): Promise<ResolvedProvider> {
  const setting = await db.setting.findUnique({ where: { key: `ai.${purpose}` } });
  const assignment = (setting?.value ?? null) as { providerId?: string; model?: string } | null;
  if (!assignment?.providerId) throw new AiNotConfiguredError(purpose);
  const p = await db.aiProvider.findUnique({ where: { id: assignment.providerId } });
  if (!p) throw new AiNotConfiguredError(purpose);
  const fallback = purpose === "transcription" ? PROVIDERS[p.kind as ProviderKind]?.suggestedTranscriptionModel : undefined;
  return providerFromRow(p, assignment.model || fallback);
}

export function providerFromRow(
  p: { id: string; kind: string; label: string; baseUrl: string | null; apiKeyEnc: string | null; model: string | null },
  modelOverride?: string,
): ResolvedProvider {
  const kind = p.kind as ProviderKind;
  const info = PROVIDERS[kind];
  return {
    id: p.id,
    kind,
    label: p.label,
    baseUrl: (p.baseUrl || info.defaultBaseUrl || "").replace(/\/+$/, "") || undefined,
    apiKey: p.apiKeyEnc ? decrypt(p.apiKeyEnc) : undefined,
    model: modelOverride || p.model || info.suggestedTextModel || info.suggestedTranscriptionModel || "",
  };
}

export async function isConfigured(purpose: Purpose) {
  try {
    await resolveProvider(purpose);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────── Text generation ─────────────────────────

export async function chat(opts: ChatOptions, provider?: ResolvedProvider): Promise<string> {
  let out = "";
  for await (const chunk of chatStream(opts, provider)) out += chunk;
  return out.trim();
}

export async function chatJson<T = unknown>(opts: ChatOptions, provider?: ResolvedProvider): Promise<T> {
  const system = `${opts.system ?? ""}\n\nRespond with a single valid JSON object and nothing else — no prose, no code fences.`.trim();
  const text = await chat({ ...opts, system, json: true }, provider);
  try {
    return unwrapSingleton(parseJsonLoose<T>(text));
  } catch {
    // Smaller models occasionally emit broken JSON; one fresh attempt usually succeeds.
    return unwrapSingleton(parseJsonLoose<T>(await chat({ ...opts, system, json: true }, provider)));
  }
}

/** `[{...}]` → `{...}`: callers of chatJson always ask for an object. */
export function unwrapSingleton<T>(value: T): T {
  return Array.isArray(value) && value.length === 1 && value[0] && typeof value[0] === "object" && !Array.isArray(value[0]) ? (value[0] as T) : value;
}

export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // fall through to the readable error below
      }
    }
    throw new Error("The model did not return valid JSON. Try again, or choose a more capable model.");
  }
}

export async function* chatStream(opts: ChatOptions, provider?: ResolvedProvider): AsyncGenerator<string> {
  const p = provider ?? (await resolveProvider("text"));
  const model = opts.model || p.model;
  if (!model) throw new AiRequestError(p.label, "config", "No model selected for this provider.");
  switch (p.kind) {
    case "anthropic":
      yield* anthropicStream(p, model, opts);
      return;
    case "gemini":
      yield* geminiStream(p, model, opts);
      return;
    case "openai":
    case "openai_compatible":
      yield* openaiStream(p, model, opts);
      return;
    default:
      throw new AiRequestError(p.label, "config", `${PROVIDERS[p.kind].label} can only be used for transcription.`);
  }
}

async function* anthropicStream(p: ResolvedProvider, model: string, opts: ChatOptions): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: p.apiKey, maxRetries: 3, timeout: 10 * 60_000 });
  const base = {
    model,
    max_tokens: opts.maxTokens ?? 32000,
    system: opts.system,
    messages: opts.messages,
  };
  try {
    const stream = FALLBACK_MODELS.has(model)
      ? client.beta.messages.stream({
          ...base,
          betas: ["server-side-fallback-2026-07-01"],
          // Re-runs a safety-declined request on a fallback model inside the same call.
          fallbacks: "default",
        } as unknown as Parameters<typeof client.beta.messages.stream>[0])
      : client.messages.stream(base);
    for await (const event of stream as AsyncIterable<{ type: string; delta?: { type: string; text?: string } }>) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
        yield event.delta.text;
      }
    }
    const final = (await stream.finalMessage()) as { stop_reason?: string | null };
    if (final.stop_reason === "refusal") {
      throw new AiRequestError(p.label, "refusal", "The model declined this request.");
    }
  } catch (err) {
    if (err instanceof AiRequestError) throw err;
    if (err instanceof Anthropic.AuthenticationError) throw new AiRequestError(p.label, 401, "The API key was rejected.");
    if (err instanceof Anthropic.NotFoundError) throw new AiRequestError(p.label, 404, `Model "${model}" was not found.`);
    if (err instanceof Anthropic.RateLimitError) throw new AiRequestError(p.label, 429, "Rate limited — try again shortly.");
    if (err instanceof Anthropic.APIError) throw new AiRequestError(p.label, err.status ?? "error", err.message);
    throw err;
  }
}

async function* openaiStream(p: ResolvedProvider, model: string, opts: ChatOptions): AsyncGenerator<string> {
  if (!p.baseUrl) throw new AiRequestError(p.label, "config", "Base URL is missing.");
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages,
  ];
  const body: Record<string, unknown> = { model, messages, stream: true };
  // OpenAI's reasoning models only accept max_completion_tokens; compatible servers expect max_tokens.
  if (opts.maxTokens) body[p.kind === "openai" ? "max_completion_tokens" : "max_tokens"] = opts.maxTokens;
  if (opts.json && p.kind === "openai") body.response_format = { type: "json_object" };

  const res = await providerFetch(p.label, `${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new AiRequestError(p.label, "stream", "Empty response.");
  for await (const data of sseData(res.body, p.label)) {
    if (data === "[DONE]") return;
    try {
      const json = JSON.parse(data);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) yield delta as string;
      if (json.error) throw new AiRequestError(p.label, "stream", JSON.stringify(json.error));
    } catch (e) {
      if (e instanceof AiRequestError) throw e;
    }
  }
}

async function* geminiStream(p: ResolvedProvider, model: string, opts: ChatOptions): AsyncGenerator<string> {
  const body: Record<string, unknown> = {
    contents: opts.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: {
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  const res = await providerFetch(p.label, `${p.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": p.apiKey ?? "" },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new AiRequestError(p.label, "stream", "Empty response.");
  for await (const data of sseData(res.body, p.label)) {
    try {
      const json = JSON.parse(data);
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) if (part.text && !part.thought) yield part.text as string;
      if (json.candidates?.[0]?.finishReason === "SAFETY") {
        throw new AiRequestError(p.label, "safety", "The model blocked this response.");
      }
    } catch (e) {
      if (e instanceof AiRequestError) throw e;
    }
  }
}

/** Yields the `data:` payloads of a server-sent-events stream; gives up if the stream goes quiet. */
async function* sseData(body: ReadableStream<Uint8Array>, label: string, idleMs = 90_000): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    let timer: NodeJS.Timeout | undefined;
    const stalled = new Promise<never>((_, rej) => {
      timer = setTimeout(() => {
        reader.cancel().catch(() => {});
        rej(new AiRequestError(label, "timeout", `The response stalled for ${Math.round(idleMs / 1000)}s.`));
      }, idleMs);
    });
    const { done, value } = await Promise.race([reader.read(), stalled]).finally(() => clearTimeout(timer));
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  if (buffer.startsWith("data:")) yield buffer.slice(5).trim();
}

// ───────────────────────── Model listing / connection test ─────────────────────────

export async function listModels(p: ResolvedProvider): Promise<string[]> {
  switch (p.kind) {
    case "anthropic": {
      const client = new Anthropic({ apiKey: p.apiKey });
      const ids: string[] = [];
      for await (const m of client.models.list()) ids.push(m.id);
      return ids;
    }
    case "gemini": {
      const res = await providerFetch(p.label, `${p.baseUrl}/models?pageSize=200`, { headers: { "x-goog-api-key": p.apiKey ?? "" } }, { timeoutMs: 20_000, attempts: 2 });
      const json = (await res.json()) as { models?: { name: string }[] };
      return (json.models ?? []).map((m) => m.name.replace(/^models\//, ""));
    }
    case "openai":
    case "openai_compatible": {
      const res = await providerFetch(p.label, `${p.baseUrl}/models`, { headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {} }, { timeoutMs: 20_000, attempts: 2 });
      const json = (await res.json()) as { data?: { id: string }[] };
      return (json.data ?? []).map((m) => m.id).sort();
    }
    case "deepgram": {
      await providerFetch(p.label, "https://api.deepgram.com/v1/projects", { headers: { Authorization: `Token ${p.apiKey}` } }, { timeoutMs: 20_000, attempts: 2 });
      return ["nova-3", "nova-3-medical", "nova-2"];
    }
    case "assemblyai": {
      await providerFetch(p.label, "https://api.assemblyai.com/v2/transcript?limit=1", { headers: { authorization: p.apiKey ?? "" } }, { timeoutMs: 20_000, attempts: 2 });
      return ["universal", "slam-1"];
    }
  }
}
