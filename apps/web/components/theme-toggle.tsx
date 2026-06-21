"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        className={cn("h-9 rounded-full", showLabel ? "w-full" : "w-[4.5rem]", className)}
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showLabel ? (
        <span className="text-xs font-medium text-muted-foreground">Theme</span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="relative inline-flex h-9 w-[4.5rem] shrink-0 items-center rounded-full border border-border/60 bg-muted/40 p-1 backdrop-blur-sm transition-colors hover:bg-muted/60"
      >
        <Sun
          className={cn(
            "relative z-10 ml-0.5 h-4 w-4 transition-colors",
            !isDark ? "text-primary" : "text-muted-foreground",
          )}
        />
        <Moon
          className={cn(
            "relative z-10 ml-auto mr-0.5 h-4 w-4 transition-colors",
            isDark ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "absolute top-1 left-1 h-7 w-7 rounded-full bg-background shadow-md shadow-black/10 transition-transform duration-200 dark:shadow-black/40",
            isDark ? "translate-x-[2.125rem]" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}
