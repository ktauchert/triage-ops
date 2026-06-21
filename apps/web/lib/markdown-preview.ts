/** First N lines of markdown source, plain text (no HTML rendering). */
export function previewMarkdownLines(text: string, maxLines = 3): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length <= maxLines) {
    return normalized;
  }

  return `${lines.slice(0, maxLines).join("\n")}\n…`;
}
