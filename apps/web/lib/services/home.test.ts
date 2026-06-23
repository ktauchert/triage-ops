import { describe, expect, it } from "vitest";
import { formatUserRole, pickHomeProjectCards } from "./home";

describe("pickHomeProjectCards", () => {
  const projects = [
    { id: "a", isFavorite: false },
    { id: "b", isFavorite: true },
    { id: "c", isFavorite: true },
  ];

  it("returns only favorite projects", () => {
    expect(pickHomeProjectCards(projects)).toEqual([
      { id: "b", isFavorite: true },
      { id: "c", isFavorite: true },
    ]);
  });

  it("returns empty array when no favorites", () => {
    expect(
      pickHomeProjectCards([
        { id: "a", isFavorite: false },
        { id: "b", isFavorite: false },
      ]),
    ).toEqual([]);
  });
});

describe("formatUserRole", () => {
  it("title-cases role enum values", () => {
    expect(formatUserRole("ADMIN")).toBe("Admin");
    expect(formatUserRole("VIEWER")).toBe("Viewer");
  });
});
