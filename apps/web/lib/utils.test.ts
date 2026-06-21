import { describe, expect, it } from "vitest";
import { previewMarkdownLines } from "./utils";

describe("previewMarkdownLines", () => {
  it("returns short text unchanged", () => {
    const text = "### Problem\nUsers see a blank page.";
    expect(previewMarkdownLines(text)).toBe(text);
  });

  it("truncates to the first N lines and adds an ellipsis marker", () => {
    const text = "line one\nline two\nline three\nline four";
    expect(previewMarkdownLines(text, 3)).toBe("line one\nline two\nline three\n…");
  });

  it("normalizes Windows line endings", () => {
    const text = "a\r\nb\r\nc\r\nd";
    expect(previewMarkdownLines(text, 2)).toBe("a\nb\n…");
  });
});
