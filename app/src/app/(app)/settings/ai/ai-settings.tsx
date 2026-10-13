"use client";

import { useState, useTransition } from "react";
import { KeyRound, PenLine, AudioLines, Trash2, Pencil, Plus, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { COMPATIBLE_PRESETS, PROVIDERS, PURPOSE_LABEL, type ProviderKind, type Purpose } from "@/lib/ai/catalog";
import { assignPurpose, deleteProvider, pingWriting, saveProvider, testProvider } from "./actions";

type Row = { id: string; kind: string; label: string; baseUrl: string | null; model: string | null; maskedKey: string };
type Assignment = { providerId?: string; model?: string } | null;

export function AiSettings({ providers, assignments }: { providers: Row[]; assignments: Record<Purpose, Assignment> }) {
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const toast = useToast();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <AssignmentCard purpose="text" icon={<PenLine className="size-5" />} providers={providers} value={assignments.text} />
        <AssignmentCard purpose="transcription" icon={<AudioLines className="size-5" />} providers={providers} value={assignments.transcription} />
      </div>

      <Card>
        <CardHeader
          title="Your providers"
          description="Keys are encrypted in your local database and only sent to the provider they belong to."
          actions={
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add provider
            </Button>
          }
        />
        {providers.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <KeyRound className="mb-3 size-8 text-brand-600" />
            <p className="font-medium">No providers yet</p>
            <p className="mt-1 max-w-md text-sm text-muted">
              Add a key from any provider. A good setup is one writing model (Claude, GPT, Gemini, or an open model via OpenRouter/Groq/Ollama)
              and one transcription service (Deepgram, AssemblyAI, OpenAI Whisper, Groq, or Gemini).
            </p>
            <Button className="mt-4" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add your first provider
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {providers.map((p) => {
              const info = PROVIDERS[p.kind as ProviderKind];
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <PlugZap className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {p.label}
                      {info.purposes.map((x) => (
                        <Badge key={x} color={x === "text" ? "brand" : "blue"}>
                          {x === "text" ? "Writing" : "Transcription"}
                        </Badge>
                      ))}
                      {[assignments.text?.providerId, assignments.transcription?.providerId].includes(p.id) && <Badge color="green">In use</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted">
                      {info.label}
                      {p.baseUrl && ` · ${p.baseUrl}`}
                      {p.model && ` · ${p.model}`}
                      {p.maskedKey && ` · key ${p.maskedKey}`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await testProvider({ id: p.id, kind: p.kind as ProviderKind });
                        toast(r.error ? r.error : `Connected — ${r.models?.length ?? 0} models available`, r.error ? "error" : "success");
                      })
                    }
                  >
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Remove ${p.label}? Features using it will stop until you choose another provider.`)) start(async () => void (await deleteProvider(p.id)));
                    }}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Notice tone="info">
        Clinical content is sent to the provider you choose. For real client data, use a provider and plan that will sign a Business Associate
        Agreement (or your local equivalent), or run a local model through Ollama / LM Studio.
      </Notice>

      {editing && <ProviderModal row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AssignmentCard({ purpose, icon, providers, value }: { purpose: Purpose; icon: React.ReactNode; providers: Row[]; value: Assignment }) {
  const eligible = providers.filter((p) => PROVIDERS[p.kind as ProviderKind].purposes.includes(purpose));
  const [providerId, setProviderId] = useState(value?.providerId ?? "");
  const [model, setModel] = useState(value?.model ?? "");
  const [models, setModels] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const selected = providers.find((p) => p.id === providerId);
  const dirty = providerId !== (value?.providerId ?? "") || model !== (value?.model ?? "");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
        <div>
          <div className="font-semibold">{purpose === "text" ? "Writing model" : "Transcription"}</div>
          <div className="text-sm text-muted">{PURPOSE_LABEL[purpose]}</div>
        </div>
        {value?.providerId && <CheckCircle2 className="ml-auto size-5 text-emerald-600" />}
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Provider">
          <Select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              const p = providers.find((x) => x.id === e.target.value);
              const info = p ? PROVIDERS[p.kind as ProviderKind] : null;
              setModel(purpose === "transcription" ? info?.suggestedTranscriptionModel ?? "" : p?.model ?? info?.suggestedTextModel ?? "");
              setModels([]);
            }}
          >
            <option value="">{eligible.length ? "Choose a provider…" : "Add a provider below first"}</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Model" hint={selected?.kind === "openai_compatible" && purpose === "transcription" ? "The endpoint must support /audio/transcriptions (e.g. Groq: whisper-large-v3)." : undefined}>
          <div className="flex gap-2">
            <Input value={model} onChange={(e) => setModel(e.target.value)} list={`models-${purpose}`} placeholder="Model ID" />
            <Button
              type="button"
              variant="outline"
              disabled={!providerId || pending}
              onClick={() =>
                start(async () => {
                  const r = await testProvider({ id: providerId, kind: selected!.kind as ProviderKind });
                  if (r.error) toast(r.error, "error");
                  else {
                    setModels(r.models ?? []);
                    toast(`${r.models?.length ?? 0} models loaded — pick one from the list`);
                  }
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Load"}
            </Button>
          </div>
          <datalist id={`models-${purpose}`}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>
        <div className="flex gap-2">
          <Button
            disabled={!dirty || pending}
            onClick={() =>
              start(async () => {
                const r = await assignPurpose(purpose, providerId, model);
                toast(r.error ?? "Saved", r.error ? "error" : "success");
              })
            }
          >
            Save
          </Button>
          {purpose === "text" && value?.providerId && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await pingWriting();
                  toast(r.error ?? `Model replied: “${r.reply}”`, r.error ? "error" : "success");
                })
              }
            >
              Send a test prompt
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ProviderModal({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [kind, setKind] = useState<ProviderKind>((row?.kind as ProviderKind) ?? "anthropic");
  const info = PROVIDERS[kind];
  const [label, setLabel] = useState(row?.label ?? info.label);
  const [baseUrl, setBaseUrl] = useState(row?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(row?.model ?? info.suggestedTextModel ?? "");
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const chooseKind = (k: ProviderKind) => {
    setKind(k);
    setLabel(PROVIDERS[k].label);
    setModel(PROVIDERS[k].suggestedTextModel ?? "");
    setBaseUrl("");
    setModels([]);
    setError(null);
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={row ? `Edit ${row.label}` : "Add an AI provider"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveProvider({ id: row?.id, kind, label, baseUrl, apiKey, model });
                if (r.error) setError(r.error);
                else {
                  toast("Provider saved");
                  onClose();
                }
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />} Save provider
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="error">{error}</Notice>}
        {!row && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PROVIDERS) as ProviderKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => chooseKind(k)}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm ${k === kind ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20" : "border-line hover:bg-canvas"}`}
              >
                <div className="font-medium">{PROVIDERS[k].label}</div>
                <div className="text-xs text-muted">{PROVIDERS[k].purposes.map((p) => (p === "text" ? "Writing" : "Transcription")).join(" + ")}</div>
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">{info.description}</p>

        {info.baseUrlEditable && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {COMPATIBLE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setBaseUrl(p.baseUrl);
                    setLabel(p.name);
                  }}
                  className="rounded-full border border-line px-2.5 py-1 text-xs hover:bg-canvas"
                >
                  {p.name}
                </button>
              ))}
            </div>
            <Field label="API base URL" required>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.com/v1" />
            </Field>
          </>
        )}

        <Field label="Display name">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="API key" required={info.keyRequired && !row} hint={row ? "Leave blank to keep the saved key." : info.keyHelp}>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={row?.maskedKey || "Paste your key"} autoComplete="off" />
        </Field>
        {info.purposes.includes("text") && (
          <Field label="Default model" hint="Click “Test & load models” to see what this key can use.">
            <div className="flex gap-2">
              <Input value={model} onChange={(e) => setModel(e.target.value)} list="provider-models" placeholder="Model ID" />
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await testProvider({ id: row?.id, kind, baseUrl, apiKey });
                    if (r.error) setError(r.error);
                    else {
                      setModels(r.models ?? []);
                      toast(`Key works — ${r.models?.length ?? 0} models`);
                    }
                  })
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Test & load models"}
              </Button>
            </div>
            <datalist id="provider-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        )}
        {!info.purposes.includes("text") && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await testProvider({ id: row?.id, kind, apiKey });
                if (r.error) setError(r.error);
                else toast("Key works");
              })
            }
          >
            Test key
          </Button>
        )}
      </div>
    </Modal>
  );
}
