"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sparkles, X, Maximize2, Minimize2, Menu as MenuIcon, ArrowUp, Mic, Trash2, Plus, CalendarCheck, Users, LineChart, History,
  ClipboardList, Share2, ShieldAlert, Sun, FileWarning, Receipt, Square,
} from "lucide-react";
import { markdownToHtml } from "@/lib/markdown";
import { cn, Avatar } from "../ui";

type Msg = { id?: string; role: "user" | "assistant"; content: string };
type Conv = { id: string; title: string; updatedAt: string };
type Ctx = { client: { id: string; name: string; status: string; sessions: number } | null; session: { id: string; title: string } | null };

const CLIENT_ACTIONS = [
  { key: "session_prep", label: "Session prep", icon: CalendarCheck },
  { key: "case_consultation", label: "Case consultation", icon: Users },
  { key: "insights", label: "Insights", icon: LineChart },
  { key: "client_history", label: "Client history", icon: History },
  { key: "treatment_plan", label: "Treatment plan", icon: ClipboardList },
  { key: "referrals", label: "Referrals & resources", icon: Share2 },
  { key: "risk", label: "Risk & safety", icon: ShieldAlert },
];
const PRACTICE_ACTIONS = [
  { key: "today", label: "My day", icon: Sun },
  { key: "unsigned", label: "Unsigned notes", icon: FileWarning },
  { key: "billing", label: "Billing check", icon: Receipt },
];

function contextFromPath(pathname: string) {
  const client = pathname.match(/^\/clients\/([^/]+)/)?.[1];
  const session = pathname.match(/^\/sessions\/([^/]+)/)?.[1];
  return { clientId: client && client !== "new" && client !== "import" ? client : null, sessionId: session ?? null };
}

export function AssistantPanel({ aiReady, userFirstName }: { aiReady: boolean; userFirstName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [showChats, setShowChats] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<Ctx>({ client: null, session: null });
  const [useCtx, setUseCtx] = useState(true);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const pathCtx = contextFromPath(pathname);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      if (detail?.prompt) setInput(detail.prompt);
    };
    window.addEventListener("open-assistant", onOpen);
    return () => window.removeEventListener("open-assistant", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    setUseCtx(true);
    if (!pathCtx.clientId && !pathCtx.sessionId) return setCtx({ client: null, session: null });
    const qs = new URLSearchParams();
    if (pathCtx.clientId) qs.set("clientId", pathCtx.clientId);
    if (pathCtx.sessionId) qs.set("sessionId", pathCtx.sessionId);
    fetch(`/api/context-label?${qs}`).then(async (r) => {
      if (r.ok) setCtx(await r.json());
    });
  }, [open, pathCtx.clientId, pathCtx.sessionId]);

  const loadConvs = useCallback(() => {
    fetch("/api/assistant").then(async (r) => {
      if (r.ok) setConvs(await r.json());
    });
  }, []);
  useEffect(() => {
    if (open) loadConvs();
  }, [open, loadConvs]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const openConv = async (id: string) => {
    setShowChats(false);
    const r = await fetch(`/api/assistant?id=${id}`);
    if (!r.ok) return;
    const c = (await r.json()) as { id: string; messages: Msg[] };
    setConvId(c.id);
    setMessages(c.messages);
  };

  const newChat = () => {
    abortRef.current?.abort();
    setConvId(null);
    setMessages([]);
    setShowChats(false);
  };

  const send = async (opts: { message?: string; action?: string; label?: string }) => {
    const text = opts.message?.trim();
    if ((!text && !opts.action) || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text || opts.label || "" }, { role: "assistant", content: "" }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: convId,
          message: text,
          action: opts.action,
          clientId: useCtx ? ctx.client?.id ?? null : null,
          sessionId: useCtx ? ctx.session?.id ?? null : null,
        }),
        signal: ctrl.signal,
      });
      const id = res.headers.get("X-Conversation-Id");
      if (id) setConvId(id);
      if (!res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `Something went wrong: ${(e as Error).message}` };
          return copy;
        });
      }
    } finally {
      setBusy(false);
      loadConvs();
    }
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results).slice(e.resultIndex).map((r) => r[0].transcript).join(" ");
      setInput((v) => `${v}${v ? " " : ""}${text.trim()}`);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const actions = ctx.client && useCtx ? CLIENT_ACTIONS : PRACTICE_ACTIONS;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-brand-200 bg-white px-5 py-3 font-medium text-brand-700 shadow-lg hover:bg-brand-50"
        >
          <Sparkles className="size-5" /> Assistant
        </button>
      )}
      {open && (
        <div className={cn("no-print fixed bottom-0 right-0 top-0 z-50 flex flex-col border-l border-line bg-canvas shadow-2xl", wide ? "w-full max-w-3xl" : "w-full max-w-md")}>
          <div className="flex h-14 items-center justify-between border-b border-line bg-white px-4">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-5 text-brand-600" /> Assistant
            </div>
            <div className="flex items-center gap-1">
              <button onClick={newChat} className="rounded p-1.5 text-muted hover:bg-black/5" title="New chat">
                <Plus className="size-4" />
              </button>
              <button onClick={() => setWide((w) => !w)} className="rounded p-1.5 text-muted hover:bg-black/5" title={wide ? "Shrink" : "Expand"}>
                {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="rounded p-1.5 text-muted hover:bg-black/5" title="Close">
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2">
            <button onClick={() => setShowChats((s) => !s)} className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-sm hover:bg-canvas">
              <MenuIcon className="size-4" /> Chats
            </button>
            <span className="truncate text-sm text-muted">{convId ? convs.find((c) => c.id === convId)?.title ?? "" : "New chat"}</span>
          </div>

          {showChats ? (
            <div className="flex-1 overflow-y-auto bg-white">
              {convs.length === 0 && <p className="p-6 text-center text-sm text-muted">No chats yet.</p>}
              {convs.map((c) => (
                <div key={c.id} className="group flex items-center border-b border-line">
                  <button onClick={() => openConv(c.id)} className="min-w-0 flex-1 px-4 py-3 text-left">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted">{new Date(c.updatedAt).toLocaleString()}</div>
                  </button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/assistant?id=${c.id}`, { method: "DELETE" });
                      if (c.id === convId) newChat();
                      loadConvs();
                    }}
                    className="mr-3 hidden rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600 group-hover:block"
                    title="Delete chat"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
              {!aiReady && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Connect an AI provider to use the assistant.{" "}
                  <Link href="/settings/ai" className="font-medium underline">
                    Add an API key
                  </Link>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center pt-8 text-center">
                  {ctx.client && useCtx ? (
                    <>
                      <Avatar name={ctx.client.name} size="lg" />
                      <div className="mt-3 font-semibold">{ctx.client.name}</div>
                      <div className="text-sm text-muted">
                        {ctx.client.status.toLowerCase()} client · {ctx.client.sessions} session{ctx.client.sessions === 1 ? "" : "s"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Sparkles className="size-6" />
                      </div>
                      <div className="mt-3 font-semibold">Hi {userFirstName}, how can I help?</div>
                      <div className="text-sm text-muted">Ask about your caseload, schedule, notes or billing.</div>
                    </>
                  )}
                  <div className="mt-6 grid w-full grid-cols-2 gap-2">
                    {actions.map((a) => (
                      <button
                        key={a.key}
                        disabled={!aiReady}
                        onClick={() => send({ action: a.key, label: a.label })}
                        className="flex items-center justify-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-medium hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                      >
                        <a.icon className="size-4 text-brand-700" /> {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="ml-10 rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white">
                        {m.content}
                      </div>
                    ) : (
                      <div key={i} className="prose-note mr-4 rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 text-sm">
                        {m.content ? <div dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }} /> : <span className="animate-pulse text-muted">Thinking…</span>}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-line bg-white p-3">
            {(ctx.client || ctx.session) && useCtx && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ctx.client && <span className="rounded-md border border-line bg-canvas px-2 py-0.5 text-xs font-medium">{ctx.client.name}</span>}
                {ctx.session && <span className="max-w-56 truncate rounded-md border border-line bg-canvas px-2 py-0.5 text-xs font-medium">{ctx.session.title}</span>}
                <button onClick={() => setUseCtx(false)} className="text-xs text-muted hover:text-ink">
                  remove context
                </button>
              </div>
            )}
            <div className="rounded-xl border border-line focus-within:border-brand-500">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send({ message: input });
                  }
                }}
                rows={2}
                placeholder="Ask a question…"
                className="block w-full resize-none rounded-xl px-3 pt-2.5 text-sm outline-none"
              />
              <div className="flex items-center justify-end gap-1 px-2 pb-2">
                <button onClick={toggleMic} className={cn("rounded-full p-1.5", listening ? "bg-red-50 text-red-600" : "text-muted hover:bg-black/5")} title="Dictate">
                  <Mic className="size-4" />
                </button>
                {busy ? (
                  <button onClick={() => abortRef.current?.abort()} className="rounded-full bg-ink p-1.5 text-white" title="Stop">
                    <Square className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => send({ message: input })}
                    disabled={!input.trim() || !aiReady}
                    className="rounded-full bg-brand-600 p-1.5 text-white disabled:bg-slate-200 disabled:text-slate-400"
                    title="Send"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted">AI-generated. Use your professional judgement.</p>
          </div>
        </div>
      )}
    </>
  );
}

interface SpeechRec {
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string } }> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
