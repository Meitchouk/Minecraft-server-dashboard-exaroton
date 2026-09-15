"use client";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/client";

const TONE = {
  ok: "bg-primary/15 text-primary border-primary/30",
  warn: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  bad: "bg-destructive/15 text-destructive border-destructive/30",
  off: "bg-muted text-muted-foreground border-border",
};
const DOT = { ok: "bg-primary", warn: "bg-chart-3", bad: "bg-destructive", off: "bg-muted-foreground" };

export function StatusBadge({ status, className, size = "md" }: { status: number | undefined; className?: string; size?: "sm" | "md" | "lg" }) {
  const tone = status === undefined ? "off" : STATUS_TONE[status] ?? "off";
  const label = status === undefined ? "…" : STATUS_LABEL[status] ?? `Estado ${status}`;
  const animate = tone === "ok" || tone === "warn";
  return (
    <span className={cn(
      "inline-flex items-center gap-2 rounded-full border font-medium",
      size === "sm" ? "px-2 py-0.5 text-xs" : size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
      TONE[tone], className,
    )}>
      <span className={cn("relative inline-block size-2 rounded-full", DOT[tone], animate && "pulse-ring")} />
      {label}
    </span>
  );
}
