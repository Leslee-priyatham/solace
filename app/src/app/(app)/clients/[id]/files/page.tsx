import { db } from "@/lib/db";
import { FilesView } from "./files-view";

export default async function FilesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const files = await db.clientFile.findMany({ where: { clientId: id }, orderBy: { uploadedAt: "desc" } });
  return <FilesView clientId={id} files={files.map((f) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, path: f.path, uploadedAt: f.uploadedAt.toISOString() }))} />;
}
