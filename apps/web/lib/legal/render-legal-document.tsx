import Link from "next/link";
import type { ReactNode } from "react";
import { readFile } from "node:fs/promises";
import path from "node:path";

function parseEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Bold (**text**), then inline code (`text`).
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      parts.push(
        <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold text-foreground">
          {match[1]}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={`${keyPrefix}-c-${match.index}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {match[2]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function parseInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseEmphasis(text.slice(lastIndex, match.index), `${match.index}-pre`));
    }

    const href = match[2];
    const isInternal = href.startsWith("/");
    if (isInternal) {
      parts.push(
        <Link key={`${match.index}-${href}`} href={href} className="underline">
          {match[1]}
        </Link>,
      );
    } else {
      parts.push(
        <a
          key={`${match.index}-${href}`}
          href={href}
          className="underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          {match[1]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...parseEmphasis(text.slice(lastIndex), `${lastIndex}-tail`));
  }

  return parts.length > 0 ? parts : [text];
}

function renderMarkdownBlock(block: string, index: number) {
  const trimmed = block.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("> ")) {
    return (
      <blockquote
        key={index}
        className="border-l-4 border-amber-400/60 bg-amber-50/50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-500/10 dark:text-amber-100"
      >
        {parseInline(trimmed.replace(/^>\s?/, ""))}
      </blockquote>
    );
  }

  if (trimmed.startsWith("## ")) {
    return (
      <h2 key={index} className="mt-8 text-xl font-semibold tracking-tight">
        {parseInline(trimmed.slice(3))}
      </h2>
    );
  }

  if (trimmed.startsWith("# ")) {
    return (
      <h1 key={index} className="text-3xl font-bold tracking-tight">
        {parseInline(trimmed.slice(2))}
      </h1>
    );
  }

  if (trimmed.startsWith("- ")) {
    const items = trimmed.split("\n").filter((line) => line.startsWith("- "));
    return (
      <ul key={index} className="list-disc space-y-1 pl-6 text-muted-foreground">
        {items.map((item, itemIndex) => (
          <li key={itemIndex}>{parseInline(item.slice(2))}</li>
        ))}
      </ul>
    );
  }

  if (trimmed.startsWith("|")) {
    const rows = trimmed.split("\n").filter((line) => line.includes("|"));
    const bodyRows = rows.filter((row) => !row.includes("---"));
    const [headerRow, ...dataRows] = bodyRows;
    const headers = headerRow
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean);

    return (
      <div key={index} className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-medium">
                  {parseInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rowIndex) => {
              const cells = row
                .split("|")
                .map((cell) => cell.trim())
                .filter(Boolean);
              return (
                <tr key={rowIndex} className="border-t">
                  {cells.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top">
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (trimmed.startsWith("---")) {
    return <hr key={index} className="my-8 border-border" />;
  }

  return (
    <p key={index} className="text-muted-foreground leading-relaxed">
      {parseInline(trimmed)}
    </p>
  );
}

export async function readLegalDocument(
  filename: "eula.md" | "privacy.md" | "impressum.md",
) {
  const filePath = path.join(process.cwd(), "public", "legal", filename);
  return readFile(filePath, "utf8");
}

export function LegalDocumentBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n\n+/);

  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-12">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </article>
  );
}
