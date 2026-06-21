import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(value: string | Date | null): string {
  if (!value) {
    return "Never";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

/** First N lines of markdown/plain text for previews (no HTML rendering). */
export function previewMarkdownLines(text: string, maxLines = 3): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length <= maxLines) {
    return normalized;
  }

  return `${lines.slice(0, maxLines).join("\n")}\n…`;
}

export function syncStatusColor(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "RUNNING":
    case "PENDING":
      return "secondary";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}
