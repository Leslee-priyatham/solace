import { APP_NAME } from "@/lib/constants";
import { cn } from "./ui";

/** Original mark: two overlapping leaves forming a calm "S" shape. */
export function Logo({ light, compact, className }: { light?: boolean; compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M6 20c0-7 5-12 13-12 0 7-5 12-13 12Z" fill="#34c8a9" />
        <path d="M26 12c0 7-5 12-13 12 0-7 5-12 13-12Z" fill={light ? "#d0f8ec" : "#0a8c76"} opacity="0.9" />
      </svg>
      {!compact && <span className={cn("text-lg font-semibold tracking-tight", light ? "text-white" : "text-ink")}>{APP_NAME}</span>}
    </span>
  );
}
