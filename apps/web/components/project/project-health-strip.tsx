import { cn } from "@/lib/utils";
import type { ProjectHealthSignal } from "@/lib/services/project-health";

const toneDotClass: Record<ProjectHealthSignal["tone"], string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

const toneTextClass: Record<ProjectHealthSignal["tone"], string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  error: "text-destructive",
  muted: "text-muted-foreground",
};

export function ProjectHealthStrip({
  signals,
  className,
}: {
  signals: ProjectHealthSignal[];
  className?: string;
}) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-3",
        className,
      )}
      aria-label="Project health"
    >
      {signals.map((signal) => (
        <span
          key={signal.id}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            toneTextClass[signal.tone],
          )}
        >
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", toneDotClass[signal.tone])}
            aria-hidden
          />
          {signal.label}
        </span>
      ))}
    </div>
  );
}
