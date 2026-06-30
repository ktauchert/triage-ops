import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  jsonRequest,
  readJson,
  routeContext,
  testAuthContextWithRole,
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
    requireApiSessionMock.mockResolvedValue(testAuthContextWithRole(UserRole.ADMIN));
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { status: "DISMISSED" }),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 when VIEWER tries to apply", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.VIEWER),
    );

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { status: "APPLIED" }),
      ctx,
    );
    expect(response.status).toBe(403);
  });

  it("returns 403 when OPERATOR tries to dismiss", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { status: "DISMISSED" }),
      ctx,
    );
    expect(response.status).toBe(403);
  });

  it("allows OPERATOR to apply", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.OPERATOR),
    );
    updateSuggestionStatusMock.mockResolvedValue({
      suggestion: { id: "suggestion-1", status: "APPLYING" },
      queued: true,
    });

    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { status: "APPLIED" }),
      ctx,
    );
    expect(response.status).toBe(202);
  });

  it("allows LEAD to dismiss", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );
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
