import { describe, expect, it } from "vitest";
import {
  isErrorResponse,
  requireOptionalPositiveInt,
  requireString,
  requireVcsProvider,
} from "./api";

describe("requireString", () => {
  it("returns trimmed string for valid input", () => {
    expect(requireString("  hello  ", "name")).toBe("hello");
  });

  it("returns error response for empty string", async () => {
    const result = requireString("", "name");
    expect(isErrorResponse(result)).toBe(true);
    if (isErrorResponse(result)) {
      expect(result.status).toBe(400);
      expect(await result.json()).toEqual({ error: "name is required" });
    }
  });
});

describe("requireOptionalPositiveInt", () => {
  it("accepts positive integers", () => {
    expect(requireOptionalPositiveInt(42, "externalProjectId")).toBe(42);
  });

  it("parses numeric strings", () => {
    expect(requireOptionalPositiveInt("42", "externalProjectId")).toBe(42);
  });

  it("requires value when configured", async () => {
    const result = requireOptionalPositiveInt(undefined, "externalProjectId", {
      required: true,
    });
    expect(isErrorResponse(result)).toBe(true);
  });
});

describe("requireVcsProvider", () => {
  it("accepts supported providers", () => {
    expect(requireVcsProvider("GITHUB")).toBe("GITHUB");
    expect(requireVcsProvider("GITLAB")).toBe("GITLAB");
  });

  it("rejects unknown providers", async () => {
    const result = requireVcsProvider("BITBUCKET");
    expect(isErrorResponse(result)).toBe(true);
    if (isErrorResponse(result)) {
      expect(await result.json()).toEqual({
        error: "provider must be GITLAB or GITHUB",
      });
    }
  });
});
