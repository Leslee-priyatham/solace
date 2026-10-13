// Provider catalog shared by the settings UI and the server-side client.
// Models are always editable — "Load models" in settings lists what the key can use.

export type ProviderKind = "openai" | "anthropic" | "gemini" | "openai_compatible" | "deepgram" | "assemblyai";
export type Purpose = "text" | "transcription";

export interface ProviderInfo {
  label: string;
  description: string;
  defaultBaseUrl?: string;
  baseUrlEditable: boolean;
  keyRequired: boolean;
  purposes: Purpose[];
  suggestedTextModel?: string;
  suggestedTranscriptionModel?: string;
  keyHelp: string;
}

export const PROVIDERS: Record<ProviderKind, ProviderInfo> = {
  anthropic: {
    label: "Anthropic (Claude)",
    description: "Claude models through the Anthropic API.",
    baseUrlEditable: false,
    keyRequired: true,
    purposes: ["text"],
    suggestedTextModel: "claude-opus-5-5",
    keyHelp: "Create a key at console.anthropic.com → API keys.",
  },
  openai: {
    label: "OpenAI",
    description: "GPT models for notes and Whisper / GPT-4o transcription.",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlEditable: false,
    keyRequired: true,
    purposes: ["text", "transcription"],
    suggestedTranscriptionModel: "whisper-1",
    keyHelp: "Create a key at platform.openai.com → API keys.",
  },
  gemini: {
    label: "Google Gemini",
    description: "Gemini models for writing; Gemini Transcribe for audio with speaker labels.",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    baseUrlEditable: false,
    keyRequired: true,
    purposes: ["text", "transcription"],
    suggestedTextModel: "gemini-3.5-flash-lite",
    // Dedicated speech-to-text model: native speaker diarization and word timestamps.
    suggestedTranscriptionModel: "gemini-3.5-transcribe",
    keyHelp: "Create a key at aistudio.google.com → Get API key.",
  },
  openai_compatible: {
    label: "OpenAI-compatible endpoint",
    description: "OpenRouter, Groq, Mistral, DeepSeek, Together, xAI, Ollama, LM Studio, vLLM — anything that speaks the OpenAI API.",
    baseUrlEditable: true,
    keyRequired: false,
    purposes: ["text", "transcription"],
    keyHelp: "Use the key from that service. Local servers such as Ollama usually need no key.",
  },
  deepgram: {
    label: "Deepgram",
    description: "Speech-to-text with built-in speaker separation.",
    baseUrlEditable: false,
    keyRequired: true,
    purposes: ["transcription"],
    suggestedTranscriptionModel: "nova-3",
    keyHelp: "Create a key at console.deepgram.com.",
  },
  assemblyai: {
    label: "AssemblyAI",
    description: "Speech-to-text with speaker labels.",
    baseUrlEditable: false,
    keyRequired: true,
    purposes: ["transcription"],
    suggestedTranscriptionModel: "universal",
    keyHelp: "Copy your key from assemblyai.com/app.",
  },
};

export const COMPATIBLE_PRESETS: { name: string; baseUrl: string; transcription?: boolean }[] = [
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", transcription: true },
  { name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { name: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  { name: "xAI", baseUrl: "https://api.x.ai/v1" },
  { name: "Ollama (local)", baseUrl: "http://localhost:11434/v1" },
  { name: "LM Studio (local)", baseUrl: "http://localhost:1234/v1" },
];

export const PURPOSE_LABEL: Record<Purpose, string> = {
  text: "Notes, plans, assistant and other writing",
  transcription: "Transcribing session audio",
};
