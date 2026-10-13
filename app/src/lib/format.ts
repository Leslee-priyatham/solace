import { format, formatDistanceToNowStrict } from "date-fns";

export function money(cents: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);
}

export function toCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value) * 100);
}

export function fullName(p: { firstName: string; lastName: string; preferredName?: string | null }) {
  return `${p.preferredName || p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

export function date(d: Date | string | null | undefined, pattern = "MMM d, yyyy") {
  if (!d) return "—";
  return format(new Date(d), pattern);
}

export function dateTime(d: Date | string | null | undefined) {
  return date(d, "MMM d, yyyy, h:mm a");
}

export function time(d: Date | string) {
  return format(new Date(d), "h:mm a");
}

export function ago(d: Date | string) {
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function duration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min${s ? ` ${s} s` : ""}`;
  return `${s} s`;
}

export function clock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function stripHtml(html: string) {
  return html
    .replace(/<\/(p|li|h[1-6]|div)>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain text (with blank-line paragraphs and "- " bullets) → simple HTML. */
export function textToHtml(text: string) {
  const blocks = text.trim().split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length && lines.every((l) => /^[-*•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
    })
    .join("");
}
