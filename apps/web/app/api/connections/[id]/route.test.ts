import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@gridnull/db";
import {
  expectForbidden,
  jsonRequest,
  readJson,
  routeContext,
  testAuthContext,
  testAuthContextWithRole,
  unauthorizedResponse,
} from "@/lib/test/route-helpers";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const deleteConnectionMock = vi.hoisted(() => vi.fn());
const setConnectionFavoriteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock,
}));

vi.mock("@/lib/services/projects", () => ({
  deleteConnection: deleteConnectionMock,
  setConnectionFavorite: setConnectionFavoriteMock,
}));

import { DELETE, PATCH } from "./route";

const ctx = routeContext({ id: "conn-1" });

describe("DELETE /api/connections/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 401 when unauthenticated", async () => {
    requireApiSessionMock.mockResolvedValue(unauthorizedResponse());

    const response = await DELETE(
      new Request("http://localhost"),
      ctx,
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for LEAD", async () => {
    requireApiSessionMock.mockResolvedValue(
      testAuthContextWithRole(UserRole.LEAD),
    );

    await expectForbidden(
      await DELETE(new Request("http://localhost"), ctx),
    );
    expect(deleteConnectionMock).not.toHaveBeenCalled();
  });

  it("returns 404 when connection not found", async () => {
    deleteConnectionMock.mockResolvedValue(false);

    const data = await readJson<{ error: string }>(
      await DELETE(new Request("http://localhost"), ctx),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("deletes connection", async () => {
    deleteConnectionMock.mockResolvedValue(true);

    const data = await readJson<{ ok: boolean }>(
      await DELETE(new Request("http://localhost"), ctx),
      200,
    );
    expect(data.ok).toBe(true);
  });
});

describe("PATCH /api/connections/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiSessionMock.mockResolvedValue(testAuthContext);
  });

  it("returns 400 when isFavorite is not boolean", async () => {
    const response = await PATCH(
      jsonRequest("PATCH", "http://localhost", { isFavorite: "yes" }),
      ctx,
    );

    const data = await readJson<{ error: string }>(response, 400);
    expect(data.error).toContain("isFavorite");
  });

  it("returns 404 when connection not found", async () => {
    setConnectionFavoriteMock.mockResolvedValue(null);

    const data = await readJson<{ error: string }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { isFavorite: true }),
        ctx,
      ),
      404,
    );
    expect(data.error).toContain("not found");
  });

  it("updates favorite flag", async () => {
    setConnectionFavoriteMock.mockResolvedValue({
      id: "conn-1",
      isFavorite: true,
    });

    const data = await readJson<{ connection: { isFavorite: boolean } }>(
      await PATCH(
        jsonRequest("PATCH", "http://localhost", { isFavorite: true }),
        ctx,
      ),
      200,
    );
    expect(data.connection.isFavorite).toBe(true);
  });
});
