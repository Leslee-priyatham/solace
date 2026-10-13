"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { REPORT_METRICS } from "@/lib/constants";

type R = { error?: string; ok?: boolean; id?: string };

export async function createDashboard(name: string): Promise<R> {
  await requireUser();
  const count = await db.dashboard.count();
  const d = await db.dashboard.create({ data: { name: name.trim() || "New dashboard", sortOrder: count } });
  revalidatePath("/reports");
  return { ok: true, id: d.id };
}

export async function renameDashboard(id: string, name: string): Promise<R> {
  await requireUser();
  await db.dashboard.update({ where: { id }, data: { name: name.trim() || "Dashboard" } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function deleteDashboard(id: string): Promise<R> {
  await requireUser();
  if ((await db.dashboard.count()) <= 1) return { error: "Keep at least one dashboard." };
  await db.dashboard.delete({ where: { id } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function setDashboardFilters(id: string, filters: { range?: string; providerId?: string }): Promise<R> {
  await requireUser();
  const d = await db.dashboard.findUniqueOrThrow({ where: { id } });
  await db.dashboard.update({ where: { id }, data: { filters: { ...((d.filters ?? {}) as object), ...filters } } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function addTile(dashboardId: string, metric: string): Promise<R> {
  await requireUser();
  const meta = REPORT_METRICS[metric];
  if (!meta) return { error: "Unknown report" };
  const count = await db.dashboardTile.count({ where: { dashboardId } });
  await db.dashboardTile.create({ data: { dashboardId, metric, title: meta.title, width: ["sessions_over_time", "revenue", "measures"].includes(metric) ? 2 : 1, sortOrder: count } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function removeTile(id: string): Promise<R> {
  await requireUser();
  await db.dashboardTile.delete({ where: { id } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function moveTile(id: string, dir: -1 | 1): Promise<R> {
  await requireUser();
  const t = await db.dashboardTile.findUniqueOrThrow({ where: { id } });
  const tiles = await db.dashboardTile.findMany({ where: { dashboardId: t.dashboardId }, orderBy: { sortOrder: "asc" } });
  const i = tiles.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= tiles.length) return { ok: true };
  [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  for (const [k, x] of tiles.entries()) await db.dashboardTile.update({ where: { id: x.id }, data: { sortOrder: k } });
  revalidatePath("/reports");
  return { ok: true };
}

export async function resizeTile(id: string): Promise<R> {
  await requireUser();
  const t = await db.dashboardTile.findUniqueOrThrow({ where: { id } });
  await db.dashboardTile.update({ where: { id }, data: { width: t.width === 2 ? 1 : 2 } });
  revalidatePath("/reports");
  return { ok: true };
}
