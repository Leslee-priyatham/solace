import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { TeamView } from "./team-view";

export const metadata = { title: "Team members" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: [{ status: "asc" }, { firstName: "asc" }], include: { _count: { select: { clients: true } } } });
  return (
    <>
      <PageHeader title="Team members" description="Invite clinicians and billing staff. Admins manage practice settings and billing." />
      <TeamView
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
          role: u.role,
          status: u.status,
          clients: u._count.clients,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          inviteToken: u.inviteToken,
          telehealthSlug: u.telehealthSlug,
        }))}
      />
    </>
  );
}
