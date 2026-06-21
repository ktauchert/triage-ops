import { describe, expect, it } from "vitest";
import { previewMarkdownLines } from "./markdown-preview";

describe("previewMarkdownLines", () => {
  it("returns short markdown unchanged", () => {
    const md = "### Problem\n\nUsers cannot log in.";
    expect(previewMarkdownLines(md, 3)).toBe(md);
  });

  it("truncates to the first N lines and adds an ellipsis marker", () => {
    const md = "line one\nline two\nline three\nline four";
    expect(previewMarkdownLines(md, 3)).toBe("line one\nline two\nline three\n…");
  });

  it("normalizes Windows line endings", () => {
    expect(previewMarkdownLines("a\r\nb\r\nc\r\nd", 2)).toBe("a\nb\n…");
  });
});
