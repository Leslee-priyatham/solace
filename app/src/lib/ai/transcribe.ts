import "server-only";
import { AiRequestError, resolveProvider, parseJsonLoose, providerFetch, readText, unwrapSingleton, type ResolvedProvider } from "./client";
import { PROVIDERS } from "./catalog";

export interface Utterance {
  start: number; // seconds
  end: number;
  speaker: string; // raw label from the provider ("A", "0", …) until mapped
  text: string;
}

export interface TranscriptResult {
  utterances: Utterance[];
  /** True when the provider separated speakers itself. */
  diarized: boolean;
  language?: string;
}

const MAX_INLINE_BYTES = 18 * 1024 * 1024;

export async function transcribe(audio: Buffer, mime: string, filename: string, provider?: ResolvedProvider): Promise<TranscriptResult> {
  const p = provider ?? (await resolveProvider("transcription"));
  switch (p.kind) {
    case "deepgram":
      return deepgram(p, audio, mime);
    case "assemblyai":
      return assemblyai(p, audio);
    case "gemini":
      return gemini(p, audio, mime);
    case "openai":
    case "openai_compatible":
      return openaiCompatible(p, audio, mime, filename);
    default:
      throw new AiRequestError(p.label, "config", "This provider can't transcribe audio. Pick a transcription provider in Settings → AI providers.");
  }
}

async function deepgram(p: ResolvedProvider, audio: Buffer, mime: string): Promise<TranscriptResult> {
  const params = new URLSearchParams({
    model: p.model || "nova-3",
    smart_format: "true",
    punctuate: "true",
    diarize: "true",
    utterances: "true",
    detect_language: "true",
  });
  const res = await providerFetch(
    p.label,
    `https://api.deepgram.com/v1/listen?${params}`,
    { method: "POST", headers: { Authorization: `Token ${p.apiKey}`, "Content-Type": mime || "audio/webm" }, body: new Uint8Array(audio) },
    { timeoutMs: 300_000 },
  );
  const json = JSON.parse(await readText(res, p.label)) as {
    results?: {
      utterances?: { start: number; end: number; speaker: number; transcript: string }[];
      channels?: { detected_language?: string; alternatives?: { transcript: string }[] }[];
    };
  };
  const utterances = (json.results?.utterances ?? []).map((u) => ({
    start: u.start,
    end: u.end,
    speaker: String(u.speaker),
    text: u.transcript,
  }));
  return { utterances, diarized: true, language: json.results?.channels?.[0]?.detected_language };
}

async function assemblyai(p: ResolvedProvider, audio: Buffer): Promise<TranscriptResult> {
  const headers = { authorization: p.apiKey ?? "" };
  const up = await providerFetch(p.label, "https://api.assemblyai.com/v2/upload", { method: "POST", headers, body: new Uint8Array(audio) }, { timeoutMs: 300_000 });
  const { upload_url } = (await up.json()) as { upload_url: string };
  const create = await providerFetch(p.label, "https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, speaker_labels: true, language_detection: true, speech_model: p.model || undefined }),
  });
  const { id } = (await create.json()) as { id: string };
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await providerFetch(p.label, `https://api.assemblyai.com/v2/transcript/${id}`, { headers }, { timeoutMs: 30_000 });
    const json = (await poll.json()) as {
      status: string;
      error?: string;
      language_code?: string;
      utterances?: { start: number; end: number; speaker: string; text: string }[];
    };
    if (json.status === "completed") {
      return {
        utterances: (json.utterances ?? []).map((u) => ({ start: u.start / 1000, end: u.end / 1000, speaker: u.speaker, text: u.text })),
        diarized: true,
        language: json.language_code,
      };
    }
    if (json.status === "error") throw new AiRequestError(p.label, "error", json.error ?? "Transcription failed");
  }
  throw new AiRequestError(p.label, "timeout", "Transcription took too long.");
}

async function gemini(p: ResolvedProvider, audio: Buffer, mime: string): Promise<TranscriptResult> {
  if (audio.length > MAX_INLINE_BYTES) {
    throw new AiRequestError(p.label, "size", "Recording is too large for Gemini inline audio (18 MB). Use Deepgram, AssemblyAI or OpenAI for long sessions.");
  }
  const model = p.model || PROVIDERS.gemini.suggestedTranscriptionModel!;
  return /transcribe/i.test(model) ? geminiTranscribeModel(p, model, audio, mime) : geminiPrompted(p, model, audio, mime);
}

type GeminiPart = {
  text?: string;
  audioTranscription?: { text?: string; speakerLabel?: string; words?: { word: string; startOffset?: string; endOffset?: string }[] };
};

async function geminiGenerate(p: ResolvedProvider, model: string, body: object) {
  const res = await providerFetch(
    p.label,
    `${p.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": p.apiKey ?? "" }, body: JSON.stringify(body) },
    { timeoutMs: 300_000 },
  );
  const json = JSON.parse(await readText(res, p.label, 300_000)) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
  return json.candidates?.[0]?.content?.parts ?? [];
}

/**
 * Gemini's dedicated speech-to-text models (e.g. gemini-3.5-transcribe). They ignore prompts and JSON
 * mode; diarization and word timestamps come from `audioTranscriptionConfig`, and each returned part is
 * one speaker turn. Diarized requests are limited to ~30 minutes, so if one is rejected we retry
 * without diarization and let the writing model split the turns.
 */
async function geminiTranscribeModel(p: ResolvedProvider, model: string, audio: Buffer, mime: string): Promise<TranscriptResult> {
  const contents = [{ role: "user", parts: [{ inline_data: { mime_type: mime || "audio/webm", data: audio.toString("base64") } }] }];
  const seconds = (s?: string) => (s ? parseFloat(s) : NaN);

  let parts: GeminiPart[];
  try {
    parts = await geminiGenerate(p, model, {
      contents,
      generationConfig: { audioTranscriptionConfig: { languageCodes: [], diarization: true, wordTimestamp: true, mode: "VERBATIM" } },
    });
  } catch (e) {
    if (!(e instanceof AiRequestError) || e.status !== 400 || /api key/i.test(e.detail)) throw e;
    parts = await geminiGenerate(p, model, { contents, generationConfig: { audioTranscriptionConfig: { languageCodes: [], mode: "VERBATIM" } } });
  }

  const turns = parts.map((x) => x.audioTranscription).filter((a): a is NonNullable<GeminiPart["audioTranscription"]> => !!a);
  if (!turns.some((t) => t.speakerLabel)) {
    const text = turns.map((t) => t.text ?? t.words?.map((w) => w.word).join(" ") ?? "").join(" ").trim();
    return { utterances: splitSentences(text, 0), diarized: false };
  }
  let clock = 0;
  const utterances = turns
    .map((t) => {
      const words = t.words ?? [];
      const start = seconds(words[0]?.startOffset);
      const end = seconds(words[words.length - 1]?.endOffset);
      const u = {
        start: Number.isFinite(start) ? start : clock,
        end: Number.isFinite(end) ? end : clock,
        speaker: t.speakerLabel || "?",
        text: (t.text ?? words.map((w) => w.word).join(" ")).trim(),
      };
      clock = u.end;
      return u;
    })
    .filter((u) => u.text);
  return { utterances, diarized: true };
}

/** General Gemini models: transcribe by prompt and parse the JSON they return. */
async function geminiPrompted(p: ResolvedProvider, model: string, audio: Buffer, mime: string): Promise<TranscriptResult> {
  const prompt =
    "Transcribe this therapy session recording verbatim. Separate speakers and label them A, B, C… in order of first speaking. " +
    'Return JSON: {"language": "<BCP-47>", "utterances": [{"start": <seconds>, "end": <seconds>, "speaker": "A", "text": "..."}]}. ' +
    "One utterance per speaker turn. Do not summarise or omit anything.";
  const parts = await geminiGenerate(p, model, {
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime || "audio/webm", data: audio.toString("base64") } }, { text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  });
  const text = parts.map((x) => x.text ?? "").join("");
  // Gemini sometimes wraps the object in an array, or returns the utterance list on its own.
  const parsed = unwrapSingleton(parseJsonLoose<{ language?: string; utterances?: Utterance[] } | Utterance[]>(text));
  const list = Array.isArray(parsed) ? parsed : parsed.utterances ?? [];
  return {
    utterances: list.map((u) => ({ ...u, speaker: String(u.speaker) })),
    diarized: true,
    language: Array.isArray(parsed) ? undefined : parsed.language,
  };
}

async function openaiCompatible(p: ResolvedProvider, audio: Buffer, mime: string, filename: string): Promise<TranscriptResult> {
  if (!p.baseUrl) throw new AiRequestError(p.label, "config", "Base URL is missing.");
  const send = async (format: string) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mime || "audio/webm" }), filename || "audio.webm");
    form.append("model", p.model || "whisper-1");
    form.append("response_format", format);
    if (format === "verbose_json") form.append("timestamp_granularities[]", "segment");
    return providerFetch(
      p.label,
      `${p.baseUrl}/audio/transcriptions`,
      { method: "POST", headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}, body: form },
      { timeoutMs: 300_000 },
    );
  };
  // Segment timestamps need verbose_json; newer models only support plain json.
  let res: Response;
  try {
    res = await send("verbose_json");
  } catch (e) {
    if (!(e instanceof AiRequestError) || e.status !== 400) throw e;
    res = await send("json");
  }
  const json = JSON.parse(await readText(res, p.label)) as {
    text?: string;
    language?: string;
    duration?: number;
    segments?: { start: number; end: number; text: string }[];
  };
  const segments = json.segments?.length
    ? json.segments.map((s) => ({ start: s.start, end: s.end, speaker: "?", text: s.text.trim() }))
    : splitSentences(json.text ?? "", json.duration ?? 0);
  return { utterances: segments, diarized: false, language: json.language };
}

/** When a provider returns one block of text, approximate per-sentence timing for display. */
function splitSentences(text: string, duration: number): Utterance[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const totalChars = sentences.reduce((n, s) => n + s.length, 0) || 1;
  let t = 0;
  return sentences.map((s) => {
    const len = duration ? (s.length / totalChars) * duration : s.split(/\s+/).length / 2.5;
    const u = { start: t, end: t + len, speaker: "?", text: s };
    t += len;
    return u;
  });
}
