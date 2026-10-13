import Link from "next/link";
import { FileText, FileUp, Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { NOTE_CATEGORY } from "@/lib/constants";
import { DefaultPicker } from "./default-picker";

export const metadata = { title: "Note templates" };

export default async function TemplatesPage() {
  const user = await requireUser();
  const prefs = (user.preferences ?? {}) as { defaultTemplateId?: string; coupleTemplateId?: string; clientNoteTemplateId?: string };
  const templates = await db.noteTemplate.findMany({ where: { archived: false }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  const custom = templates.filter((t) => !t.isSystem);
  const system = templates.filter((t) => t.isSystem);
  const options = templates.map((t) => ({ id: t.id, name: t.name, category: t.category, audience: t.audience }));
  const isDefault = (id: string) => [prefs.defaultTemplateId, prefs.coupleTemplateId, prefs.clientNoteTemplateId].includes(id);

  const card = (t: (typeof templates)[number]) => (
    <Link key={t.id} href={`/templates/${t.id}`}>
      <Card className="h-full p-5 transition hover:border-brand-300 hover:shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold">{t.name}</div>
          {isDefault(t.id) && <Star className="size-4 fill-amber-400 text-amber-400" />}
        </div>
        {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{t.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge>{NOTE_CATEGORY[t.category as keyof typeof NOTE_CATEGORY]}</Badge>
          {t.audience !== "ANY" && <Badge color="blue">{t.audience.toLowerCase()}</Badge>}
          <Badge color="gray">{((t.sections ?? []) as unknown[]).length} sections</Badge>
        </div>
      </Card>
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Note templates"
        description="Clinically rigorous formats ready to use, or build your own."
        actions={
          <>
            <ButtonLink href="/templates/convert" variant="outline">
              <FileUp className="size-4" /> Convert a PDF
            </ButtonLink>
            <ButtonLink href="/templates/new">
              <Plus className="size-4" /> New template
            </ButtonLink>
          </>
        }
      />
      <Card className="mb-8 p-5">
        <h2 className="mb-1 font-semibold">Your defaults</h2>
        <p className="mb-4 text-sm text-muted">Used automatically after each session. You can override them per client.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <DefaultPicker kind="defaultTemplateId" label="Individual sessions" value={prefs.defaultTemplateId ?? ""} options={options.filter((o) => o.category !== "CLIENT_NOTE" && o.audience !== "COUPLE")} fallback="Standard progress note" />
          <DefaultPicker kind="coupleTemplateId" label="Couples & family sessions" value={prefs.coupleTemplateId ?? ""} options={options.filter((o) => o.category !== "CLIENT_NOTE")} fallback="Couples progress note" />
          <DefaultPicker kind="clientNoteTemplateId" label="Note for the client" value={prefs.clientNoteTemplateId ?? ""} options={options.filter((o) => o.category === "CLIENT_NOTE")} fallback="Don't generate" />
        </div>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">My templates</h2>
        {custom.length === 0 ? (
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <FileText className="size-8 text-brand-600" />
            <div className="flex-1">
              <div className="font-medium">Tweak an existing format</div>
              <p className="text-sm text-muted">Open any built-in template and choose “Make a copy” to customise its sections and instructions.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{custom.map(card)}</div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Built-in templates</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{system.map(card)}</div>
      </section>
    </>
  );
}
