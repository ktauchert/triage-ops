import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const listSuggestionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/suggestions", () => ({
  listSuggestions: listSuggestionsMock,
}));

vi.mock("@triage-ops/db", () => ({
  IssueSuggestionStatus: {
    PENDING: "PENDING",
    APPLYING: "APPLYING",
    APPLY_FAILED: "APPLY_FAILED",
    DISMISSED: "DISMISSED",
    APPLIED: "APPLIED",
  },
}));

import { GET } from "./route";

const ctx = routeContext({ id: "project-1" });

describe("GET /api/projects/[id]/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await GET(
      new Request("http://localhost/api/projects/project-1/suggestions"),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("allows VIEWER to list suggestions", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole("VIEWER"),
    );
    listSuggestionsMock.mockResolvedValue([
      { id: "suggestion-1", status: "PENDING" },
    ]);

    const data = await readJson<{ suggestions: { id: string }[] }>(
      await GET(
        new Request("http://localhost/api/projects/project-1/suggestions"),
        ctx,
      ),
      200,
    );

    expect(data.suggestions).toHaveLength(1);
  });

  it("returns 400 for invalid status filter", async () => {
    const data = await readJson<{ error: string }>(
      await GET(
        new Request(
          "http://localhost/api/projects/project-1/suggestions?status=INVALID",
        ),
        ctx,
      ),
      400,
    );
    expect(data.error).toContain("status");
  });

  it("returns filtered suggestions", async () => {
    listSuggestionsMock.mockResolvedValue([
      { id: "suggestion-1", status: "PENDING" },
    ]);

    const data = await readJson<{ suggestions: { id: string }[] }>(
      await GET(
        new Request(
          "http://localhost/api/projects/project-1/suggestions?status=PENDING",
        ),
        ctx,
      ),
      200,
    );

    expect(data.suggestions[0]?.id).toBe("suggestion-1");
    expect(listSuggestionsMock).toHaveBeenCalledWith(
      testAuthContext,
      "project-1",
      "PENDING",
    );
  });

  it("returns 404 when project not found", async () => {
    listSuggestionsMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await GET(
        new Request("http://localhost/api/projects/project-1/suggestions"),
        ctx,
      ),
      404,
    );
    expect(data.error).toContain("not found");
  });
});
