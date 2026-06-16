import { describe, expect, it } from "vitest";
import {
  pickFavoriteConnectionId,
  pickFavoriteProjectId,
} from "./projects";

describe("pickFavoriteProjectId", () => {
  const projects = [
    { id: "a", isFavorite: false },
    { id: "b", isFavorite: true },
    { id: "c", isFavorite: false },
  ];

  it("prefers explicit project query param when valid", () => {
    expect(pickFavoriteProjectId(projects, "c")).toBe("c");
  });

  it("falls back to favorite project", () => {
    expect(pickFavoriteProjectId(projects)).toBe("b");
  });

  it("falls back to first project when no favorite", () => {
    expect(
      pickFavoriteProjectId([
        { id: "a", isFavorite: false },
        { id: "c", isFavorite: false },
      ]),
    ).toBe("a");
  });
});

describe("pickFavoriteConnectionId", () => {
  it("returns favorite connection id", () => {
    expect(
      pickFavoriteConnectionId([
        { id: "a", isFavorite: false },
        { id: "b", isFavorite: true },
      ]),
    ).toBe("b");
  });
});
