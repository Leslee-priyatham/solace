import Link from "next/link";
import { FileCheck2, FileClock, Loader2, AlertTriangle, PenLine } from "lucide-react";
import { Avatar, Badge, statusColor } from "./ui";
import { dateTime, duration } from "@/lib/format";
import { CAPTURE_MODE, SESSION_STATUS } from "@/lib/constants";

export type SessionRowData = {
  id: string;
  title: string | null;
  synopsis: string | null;
  startedAt: Date;
  durationSec: number;
  status: string;
  captureMode: string;
  isDemo: boolean;
  client: { id: string; firstName: string; lastName: string; email: string | null } | null;
  provider?: { firstName: string; lastName: string } | null;
  documents: { status: string }[];
};

export function SessionRow({ s, hideClient }: { s: SessionRowData; hideClient?: boolean }) {
  const signed = s.documents.length > 0 && s.documents.every((d) => d.status === "SIGNED");
  const processing = ["TRANSCRIBING", "GENERATING", "RECORDING"].includes(s.status);
  const Icon = processing ? Loader2 : s.status === "ERROR" ? AlertTriangle : signed ? FileCheck2 : FileClock;
  return (
    <Link href={`/sessions/${s.id}`} className="grid grid-cols-1 items-center gap-3 rounded-xl border border-line bg-white px-5 py-4 transition hover:border-brand-300 hover:shadow-sm md:grid-cols-[180px_220px_1fr_auto]">
      <div className="text-sm">
        <div className="font-medium">{dateTime(s.startedAt)}</div>
        <div className="text-xs text-muted">
          {s.durationSec ? duration(s.durationSec) : CAPTURE_MODE[s.captureMode as keyof typeof CAPTURE_MODE]}
          {s.provider && ` · ${s.provider.firstName}`}
        </div>
      </div>
      {!hideClient && (
        <div className="flex min-w-0 items-center gap-2.5">
          {s.client ? (
            <>
              <Avatar name={`${s.client.firstName} ${s.client.lastName}`} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {s.client.firstName} {s.client.lastName}
                </div>
                {s.client.email && <div className="truncate text-xs text-muted">{s.client.email}</div>}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted">Unassigned</span>
          )}
        </div>
      )}
      <div className={`flex min-w-0 items-start gap-3 ${hideClient ? "md:col-span-2" : ""}`}>
        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${signed ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}`}>
          <Icon className={`size-4 ${processing ? "animate-spin" : ""}`} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{s.title || "Untitled session"}</div>
          <div className="truncate text-xs text-muted">{s.synopsis || (processing ? "Processing…" : "No summary yet")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {s.isDemo && <Badge color="violet">Demo</Badge>}
        {s.status !== "READY" ? (
          <Badge color={statusColor(s.status)}>{SESSION_STATUS[s.status as keyof typeof SESSION_STATUS] ?? s.status}</Badge>
        ) : signed ? (
          <Badge color="green">Signed</Badge>
        ) : (
          <Badge color="amber">
            <PenLine className="mr-1 size-3" /> To sign
          </Badge>
        )}
      </div>
    </Link>
  );
}

export const sessionRowInclude = {
  client: { select: { id: true, firstName: true, lastName: true, email: true } },
  provider: { select: { firstName: true, lastName: true } },
  documents: { select: { status: true } },
} as const;
