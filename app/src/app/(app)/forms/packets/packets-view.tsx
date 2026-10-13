"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Package, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, cn } from "@/components/ui";
import { Modal, useToast } from "@/components/client-ui";
import { deletePacket, savePacket } from "../actions";

type Packet = { id: string; name: string; description: string | null; formIds: string[] };

export function PacketsView({ packets, forms }: { packets: Packet[]; forms: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<Packet | "new" | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => forms.find((f) => f.id === id)?.name ?? "Removed form";
  return (
    <>
      {packets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-6" />}
            title="Send your intake process in one click"
            description="Bundle forms like intake, consent and assessments into a reusable packet."
            action={
              forms.length ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus className="size-4" /> Create your first packet
                </Button>
              ) : (
                <Link href="/forms/library" className="text-sm font-medium text-brand-700">
                  Add some forms first →
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New packet
            </Button>
          </div>
          {packets.map((p) => (
            <Card key={p.id} className="flex items-start gap-4 p-5">
              <Package className="mt-0.5 size-5 text-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name}</div>
                {p.description && <p className="text-sm text-muted">{p.description}</p>}
                <ol className="mt-2 list-inside list-decimal text-sm">
                  {p.formIds.map((id) => (
                    <li key={id}>{name(id)}</li>
                  ))}
                </ol>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={() => confirm(`Delete ${p.name}?`) && start(async () => void (await deletePacket(p.id)))}>
                <Trash2 className="size-4 text-red-600" />
              </Button>
            </Card>
          ))}
        </div>
      )}
      {editing && <PacketModal packet={editing === "new" ? null : editing} forms={forms} onClose={() => setEditing(null)} />}
    </>
  );
}

function PacketModal({ packet, forms, onClose }: { packet: Packet | null; forms: { id: string; name: string }[]; onClose: () => void }) {
  const [name, setName] = useState(packet?.name ?? "");
  const [description, setDescription] = useState(packet?.description ?? "");
  const [ids, setIds] = useState<string[]>(packet?.formIds ?? []);
  const [pending, start] = useTransition();
  const toast = useToast();
  const move = (i: number, d: -1 | 1) =>
    setIds((s) => {
      const c = [...s];
      const j = i + d;
      if (j < 0 || j >= c.length) return s;
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  return (
    <Modal
      open
      onClose={onClose}
      title={packet ? "Edit packet" : "New packet"}
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePacket({ id: packet?.id, name, description, formIds: ids });
              if (r.error) toast(r.error, "error");
              else onClose();
            })
          }
        >
          Save packet
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New client intake" />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Forms, in the order clients see them">
          <div className="space-y-1.5">
            {ids.map((id, i) => (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                <span className="w-5 text-muted">{i + 1}.</span>
                <span className="flex-1">{forms.find((f) => f.id === id)?.name}</span>
                <button onClick={() => move(i, -1)} className="text-muted hover:text-ink">
                  <ArrowUp className="size-4" />
                </button>
                <button onClick={() => move(i, 1)} className="text-muted hover:text-ink">
                  <ArrowDown className="size-4" />
                </button>
                <button onClick={() => setIds((s) => s.filter((x) => x !== id))} className="text-muted hover:text-red-600">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {forms
                .filter((f) => !ids.includes(f.id))
                .map((f) => (
                  <button key={f.id} onClick={() => setIds((s) => [...s, f.id])} className={cn("rounded-full border border-line px-2.5 py-1 text-xs hover:bg-canvas")}>
                    + {f.name}
                  </button>
                ))}
            </div>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
