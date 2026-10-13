import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { AssistantSettings } from "./assistant-settings";

export const metadata = { title: "Assistant" };

export default async function AssistantSettingsPage() {
  const u = await requireUser();
  const prefs = (u.preferences ?? {}) as { memory?: boolean; guidance?: string };
  const [memories, skills, routines] = await Promise.all([
    db.assistantMemory.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    db.assistantSkill.findMany({ orderBy: { createdAt: "asc" } }),
    db.assistantRoutine.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Assistant" description="Customise how the assistant works with you." />
      <AssistantSettings
        prefs={{ memory: prefs.memory !== false, guidance: prefs.guidance ?? "" }}
        memories={memories.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString() }))}
        skills={skills.map((s) => ({ id: s.id, name: s.name, description: s.description, instructions: s.instructions }))}
        routines={routines.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", prompt: r.prompt, trigger: r.trigger, timeOfDay: r.timeOfDay ?? "08:00", enabled: r.enabled, lastRunAt: r.lastRunAt?.toISOString() ?? null }))}
      />
    </>
  );
}
