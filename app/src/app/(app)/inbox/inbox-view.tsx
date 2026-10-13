"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Archive, ArchiveRestore, Search, Plus, Megaphone, Loader2, MessageSquare, Mail, MailOpen, Ban, X } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Field, Input, Select, Textarea, cn } from "@/components/ui";
import { Menu, Modal, useToast } from "@/components/client-ui";
import { ago, dateTime } from "@/lib/format";
import { markRead, sendAnnouncement, sendMessage, setArchived, setBlocked } from "./actions";

type Conv = { id: string; clientId: string; name: string; preview: string; lastAt: string; unread: number };
type Msg = { id: string; sender: string; authorName: string | null; body: string; attachmentName: string | null; attachmentPath: string | null; createdAt: string };
type Active = { id: string | null; clientId: string; name: string; archived: boolean; portalToken: string | null; messages: Msg[] };

export function InboxView({
  view,
  conversations,
  active,
  clients,
  announcements,
  blocked,
}: {
  view: "inbox" | "archived" | "announcements";
  conversations: Conv[];
  active: Active | null;
  clients: { id: string; name: string; email: string | null }[];
  announcements: { id: string; subject: string; body: string; count: number; sentAt: string }[];
  blocked: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);

  // Light polling so client replies show up without reloading.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  const list = conversations.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const tab = (key: string, label: string, href: string) => (
    <Link href={href} className={cn("rounded-md px-3 py-1.5 text-sm font-medium", view === key ? "bg-brand-50 text-brand-800" : "text-muted")}>
      {label}
    </Link>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line">
          {tab("inbox", "Inbox", "/inbox")}
          {tab("archived", "Archived", "/inbox?view=archived")}
          {tab("announcements", "Announcements", "/inbox?view=announcements")}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setAnnOpen(true)}>
            <Megaphone className="size-4" /> Announcement
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" /> New message
          </Button>
        </div>
      </div>

      {view === "announcements" ? (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <Card>
              <EmptyState icon={<Megaphone className="size-6" />} title="Send bulk messages" description="Let all or some clients know about holiday closures, fee changes or new services." action={<Button onClick={() => setAnnOpen(true)}>New announcement</Button>} />
            </Card>
          ) : (
            announcements.map((a) => (
              <Card key={a.id} className="p-5">
                <div className="flex justify-between gap-4">
                  <div className="font-semibold">{a.subject}</div>
                  <div className="text-xs text-muted">
                    {dateTime(a.sentAt)} · {a.count} recipient{a.count === 1 ? "" : "s"}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-muted">{a.body}</p>
              </Card>
            ))
          )}
        </div>
      ) : conversations.length === 0 && !active ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="size-6" />}
            title="Secure, HIPAA-minded messaging"
            description="Message clients about scheduling, forms and invoices instead of email. Clients read and reply in their portal."
            action={<Button onClick={() => setNewOpen(true)}>Start a conversation</Button>}
          />
        </Card>
      ) : (
        <div className="grid h-[calc(100vh-230px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-xl border border-line bg-white md:grid-cols-[320px_1fr]">
          <div className="flex min-h-0 flex-col border-r border-line">
            <div className="border-b border-line p-3">
              <div className="flex items-center gap-2 rounded-lg bg-canvas px-3">
                <Search className="size-4 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 flex-1 bg-transparent text-sm outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {list.map((c) => (
                <Link
                  key={c.id}
                  href={`/inbox?${view === "archived" ? "view=archived&" : ""}c=${c.id}`}
                  className={cn("flex gap-3 border-b border-line px-4 py-3 hover:bg-canvas", active?.id === c.id && "bg-brand-50")}
                >
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{c.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">{ago(c.lastAt)}</span>
                    </div>
                    <div className={cn("truncate text-xs", c.unread ? "text-ink" : "text-muted")}>{c.preview}</div>
                  </div>
                  {c.unread > 0 && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-500" />}
                </Link>
              ))}
            </div>
          </div>
          {active ? <Thread key={active.id ?? active.clientId} active={active} isBlocked={blocked.includes(active.clientId)} /> : <div className="hidden items-center justify-center text-sm text-muted md:flex">Select a conversation</div>}
        </div>
      )}

      <NewMessageModal open={newOpen} onClose={() => setNewOpen(false)} clients={clients} />
      <AnnouncementModal open={annOpen} onClose={() => setAnnOpen(false)} clients={clients} />
    </>
  );
}

function Thread({ active, isBlocked }: { active: Active; isBlocked: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => end.current?.scrollIntoView(), [active.messages.length]);

  const send = () =>
    start(async () => {
      const form = new FormData();
      form.append("clientId", active.clientId);
      form.append("body", body);
      if (file) form.append("file", file);
      const r = await sendMessage(form);
      if (r.error) toast(r.error, "error");
      else {
        setBody("");
        setFile(null);
        if (!active.id && r.id) router.push(`/inbox?c=${r.id}`);
        else router.refresh();
      }
    });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <Avatar name={active.name} size="sm" />
        <Link href={`/clients/${active.clientId}`} className="font-semibold hover:text-brand-700">
          {active.name}
        </Link>
        <div className="ml-auto flex gap-1">
          {active.id && (
            <>
              <button title="Mark unread" onClick={() => start(async () => (await markRead(active.id!, true), router.push("/inbox")))} className="rounded p-1.5 text-muted hover:bg-black/5">
                <Mail className="size-4" />
              </button>
              <button
                title={active.archived ? "Move to inbox" : "Archive"}
                onClick={() => start(async () => (await setArchived(active.id!, !active.archived), router.push(active.archived ? "/inbox?view=archived" : "/inbox")))}
                className="rounded p-1.5 text-muted hover:bg-black/5"
              >
                {active.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </button>
            </>
          )}
          <Menu
            items={[
              active.portalToken ? { label: "Open client's portal view", href: `/portal/${active.portalToken}` } : null,
              { label: isBlocked ? "Allow messages from client" : "Block messages from client", onClick: async () => (await setBlocked(active.clientId, !isBlocked), toast(isBlocked ? "Client unblocked" : "Client blocked")) },
            ]}
          />
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/50 px-5 py-4">
        {active.messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Start the conversation with {active.name.split(" ")[0]}.</p>}
        {active.messages.map((m) => {
          const mine = m.sender === "PROVIDER";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm", mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm border border-line bg-white")}>
                {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                {m.attachmentPath && (
                  <a href={`/api/files/${m.attachmentPath}?download=1`} className={cn("mt-1 flex items-center gap-1.5 underline", mine ? "text-white" : "text-brand-700")}>
                    <Paperclip className="size-3.5" /> {m.attachmentName}
                  </a>
                )}
                <div className={cn("mt-1 text-[11px]", mine ? "text-white/70" : "text-muted")}>
                  {mine ? m.authorName ?? "You" : active.name.split(" ")[0]} · {dateTime(m.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="border-t border-line p-3">
        {isBlocked && <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-700"><Ban className="size-3.5" /> This client is blocked from messaging.</p>}
        {file && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Paperclip className="size-4 text-muted" /> {file.name}
            <button onClick={() => setFile(null)} className="text-muted hover:text-red-600">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => fileInput.current?.click()} className="rounded-lg p-2 text-muted hover:bg-black/5" title="Attach a file">
            <Paperclip className="size-5" />
          </button>
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            }}
            placeholder="Write a message… (Ctrl+Enter to send)"
            className="flex-1 resize-none"
          />
          <Button onClick={send} disabled={pending || (!body.trim() && !file)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          <MailOpen className="mr-1 inline size-3" />
          Clients see new messages in their portal. Avoid sharing more clinical detail than needed.
        </p>
      </div>
    </div>
  );
}

function NewMessageModal({ open, onClose, clients }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New message"
      footer={
        <Button
          disabled={!clientId}
          onClick={() => {
            onClose();
            router.push(`/inbox?client=${clientId}`);
          }}
        >
          Continue
        </Button>
      }
    >
      <Field label="To">
        <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Choose a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

function AnnouncementModal({ open, onClose, clients }: { open: boolean; onClose: () => void; clients: { id: string; name: string; email: string | null }[] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="New announcement"
      description="Each client receives it as a private message — they can't see other recipients."
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendAnnouncement({ subject, body, clientIds: ids });
              if (r.error) toast(r.error, "error");
              else {
                toast(`Sent to ${ids.length} client${ids.length === 1 ? "" : "s"}`);
                onClose();
                setSubject("");
                setBody("");
                setIds([]);
                router.push("/inbox?view=announcements");
              }
            })
          }
        >
          {pending && <Loader2 className="size-4 animate-spin" />} Send announcement
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Office closed on Friday" />
        </Field>
        <Field label="Message">
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label={`Recipients (${ids.length})`}>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => setIds(clients.map((c) => c.id))} className="text-xs font-medium text-brand-700">
              Select all active clients
            </button>
            <button type="button" onClick={() => setIds([])} className="text-xs text-muted">
              Clear
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-line">
            {clients.map((c) => (
              <label key={c.id} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
                <input type="checkbox" className="accent-brand-600" checked={ids.includes(c.id)} onChange={() => setIds((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
                {c.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
