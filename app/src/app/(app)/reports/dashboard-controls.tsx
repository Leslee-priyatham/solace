"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { Menu, Modal, useToast } from "@/components/client-ui";
import { addTile, createDashboard, deleteDashboard, moveTile, removeTile, renameDashboard, resizeTile, setDashboardFilters } from "./actions";

export function DashboardControls({
  dashboard,
  range,
  ranges,
  providerId,
  providers,
  metrics,
}: {
  dashboard: { id: string; name: string };
  range: string;
  ranges: [string, string][];
  providerId: string;
  providers: { id: string; name: string }[];
  metrics: { key: string; title: string; description: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <Select value={range} onChange={(e) => start(async () => void (await setDashboardFilters(dashboard.id, { range: e.target.value })))} className="w-40">
        {ranges.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      {providers.length > 1 && (
        <Select value={providerId} onChange={(e) => start(async () => void (await setDashboardFilters(dashboard.id, { providerId: e.target.value })))} className="w-44">
          <option value="">All clinicians</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      )}
      <Button variant="outline" size="sm" onClick={() => router.refresh()} disabled={pending} title="Refresh">
        <RefreshCw className="size-4" />
      </Button>
      <Button size="sm" onClick={() => setAdding(true)}>
        <Plus className="size-4" /> Add report
      </Button>
      <Menu
        items={[
          {
            label: "New dashboard",
            onClick: async () => {
              const name = prompt("Dashboard name", "New dashboard");
              if (!name) return;
              const r = await createDashboard(name);
              if (r.id) router.push(`/reports?d=${r.id}`);
            },
          },
          {
            label: "Rename dashboard",
            onClick: async () => {
              const name = prompt("Dashboard name", dashboard.name);
              if (name) await renameDashboard(dashboard.id, name);
            },
          },
          {
            label: "Delete dashboard",
            danger: true,
            onClick: async () => {
              if (!confirm(`Delete “${dashboard.name}”?`)) return;
              const r = await deleteDashboard(dashboard.id);
              if (r.error) toast(r.error, "error");
              else router.push("/reports");
            },
          },
        ]}
      />
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a report" size="lg">
        <div className="grid gap-2 sm:grid-cols-2">
          {metrics.map((m) => (
            <button
              key={m.key}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await addTile(dashboard.id, m.key);
                  setAdding(false);
                })
              }
              className="rounded-lg border border-line p-3 text-left hover:border-brand-300 hover:bg-brand-50"
            >
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-muted">{m.description}</div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function TileMenu({ id, wide }: { id: string; wide: boolean }) {
  return (
    <Menu
      items={[
        { label: "Move earlier", onClick: () => moveTile(id, -1) },
        { label: "Move later", onClick: () => moveTile(id, 1) },
        { label: wide ? "Make narrow" : "Make wide", onClick: () => resizeTile(id) },
        { label: "Remove from dashboard", danger: true, onClick: () => removeTile(id) },
      ]}
    />
  );
}
