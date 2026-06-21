import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  jsonRequest,
  readJson,
  routeContext,
  testAuthContext,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const updateSuggestionStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/suggestions", () => ({
  updateSuggestionStatus: updateSuggestionStatusMock,
}));

import { PATCH } from "./route";

const ctx = routeContext({ id: "project-1", suggestionId: "suggestion-1" });

describe("PATCH /api/projects/[id]/suggestions/[suggestionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { status: "DISMISSED" }),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid status", async () => {
    const data = await readJson<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { status: "PENDING" }),
        ctx,
      ),
      400,
    );
    expect(data.error).toContain("DISMISSED");
  });

  it("dismisses suggestion with 200", async () => {
    updateSuggestionStatusMock.mockResolvedValue({
      suggestion: { id: "suggestion-1", status: "DISMISSED" },
      queued: false,
    });

    const data = await readJson<{ suggestion: { status: string } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { status: "DISMISSED" }),
        ctx,
      ),
      200,
    );

    expect(data.suggestion.status).toBe("DISMISSED");
  });

  it("applies suggestion with 202", async () => {
    updateSuggestionStatusMock.mockResolvedValue({
      suggestion: { id: "suggestion-1", status: "APPLYING" },
      queued: true,
    });

    const data = await readJson<{ suggestion: { status: string } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { status: "APPLIED" }),
        ctx,
      ),
      202,
    );

    expect(data.suggestion.status).toBe("APPLYING");
  });

  it("returns 404 when suggestion not found", async () => {
    updateSuggestionStatusMock.mockResolvedValue(undefined);

    const data = await readJson<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { status: "DISMISSED" }),
        ctx,
      ),
      404,
    );
    expect(data.error).toContain("not found");
  });
});
