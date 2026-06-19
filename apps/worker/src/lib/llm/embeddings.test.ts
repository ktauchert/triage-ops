import { describe, expect, it } from "vitest";
import {
  buildIssueEmbeddingText,
  embedIssues,
} from "./embeddings.js";

describe("buildIssueEmbeddingText", () => {
  it("combines title and description", () => {
    expect(
      buildIssueEmbeddingText({
        id: "1",
        title: "Login fails",
        description: "SSO returns 500",
      }),
    ).toBe("Login fails\n\nSSO returns 500");
  });

  it("uses title only when description is empty", () => {
    expect(
      buildIssueEmbeddingText({
        id: "1",
        title: "Login fails",
        description: "  ",
      }),
    ).toBe("Login fails");
  });
});

describe("embedIssues", () => {
  it("maps issue ids to embedding vectors", async () => {
    const issues = [
      { id: "a", title: "A", description: null },
      { id: "b", title: "B", description: "body" },
    ];

    const map = await embedIssues(issues, async (texts) =>
      texts.map((_, index) => [index, index + 0.5]),
    );

    expect(map.get("a")).toEqual([0, 0.5]);
    expect(map.get("b")).toEqual([1, 1.5]);
  });
});
