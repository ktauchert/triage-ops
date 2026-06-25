import { describe, expect, it } from "vitest";
import {
  legacyProjectRedirectPath,
  projectDashboardPath,
} from "./navigation";

describe("projectDashboardPath", () => {
  it("builds the project workspace route", () => {
    expect(projectDashboardPath("proj-123")).toBe("/project/proj-123");
  });
});

describe("legacyProjectRedirectPath", () => {
  it("maps legacy home query param to project workspace", () => {
    expect(legacyProjectRedirectPath("proj-123")).toBe("/project/proj-123");
  });

  it("returns null when param is missing or blank", () => {
    expect(legacyProjectRedirectPath(undefined)).toBeNull();
    expect(legacyProjectRedirectPath(null)).toBeNull();
    expect(legacyProjectRedirectPath("")).toBeNull();
    expect(legacyProjectRedirectPath("   ")).toBeNull();
  });

  it("trims whitespace from project id", () => {
    expect(legacyProjectRedirectPath("  proj-123  ")).toBe("/project/proj-123");
  });
});
