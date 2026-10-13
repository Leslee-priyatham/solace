import { requireUser, practice } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/shell/sidebar";
import { CommandSearch } from "@/components/shell/command-search";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { ToastProvider } from "@/components/client-ui";
import { isConfigured } from "@/lib/ai/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const p = await practice();
  const [unread, aiReady] = await Promise.all([
    db.conversation.aggregate({ _sum: { providerUnread: true }, where: { archived: false } }),
    isConfigured("text"),
  ]);
  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          user={{ name: `${user.firstName} ${user.lastName}`, role: user.role, email: user.email }}
          practiceName={p.displayName || p.name}
          unreadMessages={unread._sum.providerUnread ?? 0}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-10">{children}</div>
        </main>
      </div>
      <CommandSearch />
      <AssistantPanel aiReady={aiReady} userFirstName={user.firstName} />
    </ToastProvider>
  );
}
