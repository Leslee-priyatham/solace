import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { InboxView } from "./inbox-view";

export const metadata = { title: "Messaging" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string; client?: string; view?: string; q?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "archived" ? "archived" : sp.view === "announcements" ? "announcements" : "inbox";
  const [conversations, clients, announcements, blockedSetting] = await Promise.all([
    db.conversation.findMany({
      where: { archived: view === "archived" },
      include: { client: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
    }),
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT"] } }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true, email: true } }),
    view === "announcements" ? db.announcement.findMany({ orderBy: { sentAt: "desc" } }) : Promise.resolve([]),
    db.setting.findUnique({ where: { key: "messaging.blocked" } }),
  ]);

  // Opening /inbox?client=… jumps to (or starts) that client's thread.
  let activeId = sp.c ?? null;
  let draftClientId: string | null = null;
  if (sp.client) {
    const existing = conversations.find((c) => c.clientId === sp.client);
    if (existing) activeId = existing.id;
    else draftClientId = sp.client;
  }
  if (!activeId && !draftClientId && view !== "announcements") activeId = conversations[0]?.id ?? null;

  const active = activeId
    ? await db.conversation.findUnique({ where: { id: activeId }, include: { client: true, messages: { orderBy: { createdAt: "asc" } } } })
    : null;
  if (active && active.providerUnread > 0) await db.conversation.update({ where: { id: active.id }, data: { providerUnread: 0 } });
  const draftClient = draftClientId ? clients.find((c) => c.id === draftClientId) ?? null : null;

  return (
    <>
      <PageHeader title="Messaging" description="Secure messages with your clients. Clients reply from their portal." />
      <InboxView
        view={view}
        blocked={(blockedSetting?.value ?? []) as string[]}
        conversations={conversations.map((c) => ({
          id: c.id,
          clientId: c.clientId,
          name: `${c.client.firstName} ${c.client.lastName}`,
          preview: c.messages[0] ? `${c.messages[0].sender === "PROVIDER" ? "You: " : ""}${c.messages[0].body || c.messages[0].attachmentName || ""}` : "No messages yet",
          lastAt: c.lastMessageAt.toISOString(),
          unread: c.providerUnread,
        }))}
        active={
          active
            ? {
                id: active.id,
                clientId: active.clientId,
                name: `${active.client.firstName} ${active.client.lastName}`,
                archived: active.archived,
                portalToken: active.client.portalToken,
                messages: active.messages.map((m) => ({ id: m.id, sender: m.sender, authorName: m.authorName, body: m.body, attachmentName: m.attachmentName, attachmentPath: m.attachmentPath, createdAt: m.createdAt.toISOString() })),
              }
            : draftClient
              ? { id: null, clientId: draftClient.id, name: `${draftClient.firstName} ${draftClient.lastName}`, archived: false, portalToken: null, messages: [] }
              : null
        }
        clients={clients.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email }))}
        announcements={announcements.map((a) => ({ id: a.id, subject: a.subject, body: a.body, count: (a.clientIds as string[]).length, sentAt: a.sentAt.toISOString() }))}
      />
    </>
  );
}
