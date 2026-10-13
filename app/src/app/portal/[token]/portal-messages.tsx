"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Loader2, X } from "lucide-react";
import { Button, Notice, Textarea, cn } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { markPortalRead, sendClientMessage } from "./actions";

type Msg = { id: string; sender: string; authorName: string | null; body: string; attachmentName: string | null; createdAt: string };

export function PortalMessages({ token, clinician, messages }: { token: string; clinician: string; messages: Msg[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markPortalRead(token);
    end.current?.scrollIntoView({ block: "nearest" });
  }, [token, messages.length]);
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="rounded-xl border border-line">
      <div className="max-h-96 space-y-3 overflow-y-auto bg-canvas/50 p-4">
        {messages.length === 0 && <p className="py-6 text-center text-sm text-muted">Send {clinician.split(" ")[0]} a secure message.</p>}
        {messages.map((m) => {
          const mine = m.sender === "CLIENT";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-line bg-white")}>
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.attachmentName && (
                  <a href={`/api/public/portal/${token}/file?m=${m.id}`} className={cn("mt-1 flex items-center gap-1.5 underline", mine ? "text-white" : "text-brand-700")}>
                    <Paperclip className="size-3.5" /> {m.attachmentName}
                  </a>
                )}
                <div className={cn("mt-1 text-[11px]", mine ? "text-white/70" : "text-muted")}>
                  {mine ? "You" : m.authorName ?? clinician} · {dateTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {error && (
          <Notice tone="error" className="mb-2">
            {error}
          </Notice>
        )}
        {file && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Paperclip className="size-4" /> {file.name}
            <button onClick={() => setFile(null)}>
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileInput.current?.click()} className="rounded-lg p-2 text-muted hover:bg-black/5" title="Attach a file">
            <Paperclip className="size-5" />
          </button>
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" className="flex-1 resize-none" />
          <Button
            disabled={pending || (!body.trim() && !file)}
            onClick={() =>
              start(async () => {
                setError(null);
                const form = new FormData();
                form.append("body", body);
                if (file) form.append("file", file);
                const r = await sendClientMessage(token, form);
                if (r.error) setError(r.error);
                else {
                  setBody("");
                  setFile(null);
                  router.refresh();
                }
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">For emergencies, call your local emergency number — messages aren't monitored around the clock.</p>
      </div>
    </div>
  );
}
