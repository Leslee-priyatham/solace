import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { token } from "./crypto";

// Local file storage. Paths stored in the DB are relative to ROOT: ./uploads by default (gitignored), or
// the data folder the launcher sets up (SOLACE_UPLOADS_DIR) so records survive app updates.
const ROOT = path.resolve(process.env.SOLACE_UPLOADS_DIR || path.join(process.cwd(), "uploads"));

export async function saveUpload(folder: string, filename: string, data: Buffer) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
  const rel = path.posix.join(folder, `${Date.now()}-${token(4)}-${safe}`);
  const abs = path.join(ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return rel;
}

/** Absolute path for a stored file, or null if `rel` points outside the uploads folder. */
function insideRoot(rel: string) {
  const abs = path.resolve(ROOT, rel);
  const fromRoot = path.relative(ROOT, abs);
  // A plain prefix check would also accept sibling folders such as ../uploads_old/.
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return abs;
}

export async function readUpload(rel: string) {
  const abs = insideRoot(rel);
  if (!abs) throw new Error("Invalid path");
  return readFile(abs);
}

export async function deleteUpload(rel: string | null | undefined) {
  if (!rel) return;
  const abs = insideRoot(rel);
  if (!abs) return;
  await unlink(abs).catch(() => {});
}

export function mimeFromName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      webm: "audio/webm",
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      wav: "audio/wav",
      flac: "audio/flac",
      aac: "audio/aac",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      txt: "text/plain",
      csv: "text/csv",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }[ext] ?? "application/octet-stream"
  );
}

/** Extracts text from an uploaded PDF or text file (for template/form/compliance conversion). */
export async function extractText(data: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") {
    // pdf-parse's index runs a self-test on import; load the library entry directly.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdf = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
    return (await pdf(data)).text;
  }
  return data.toString("utf8");
}
