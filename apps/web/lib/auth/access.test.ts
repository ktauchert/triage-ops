import { describe, expect, it } from "vitest";
import {
  canAccessConnection,
  connectionWhereClause,
  projectWhereClause,
} from "./access";
import type { AuthContext } from "./session";

const sharedCtx: AuthContext = {
  userId: "user-1",
  dataScope: "shared",
};

const perUserCtx: AuthContext = {
  userId: "user-1",
  dataScope: "per_user",
};

describe("connectionWhereClause", () => {
  it("returns empty filter for shared scope", () => {
    expect(connectionWhereClause(sharedCtx)).toEqual({});
  });

  it("filters by userId for per_user scope", () => {
    expect(connectionWhereClause(perUserCtx)).toEqual({ userId: "user-1" });
  });
});

describe("projectWhereClause", () => {
  it("returns empty filter for shared scope", () => {
    expect(projectWhereClause(sharedCtx)).toEqual({});
  });

  it("filters by connection userId for per_user scope", () => {
    expect(projectWhereClause(perUserCtx)).toEqual({
      connection: { userId: "user-1" },
    });
  });
});

describe("canAccessConnection", () => {
  it("allows any connection in shared scope", () => {
    expect(canAccessConnection(sharedCtx, null)).toBe(true);
    expect(canAccessConnection(sharedCtx, "other-user")).toBe(true);
  });

  it("allows only owned connections in per_user scope", () => {
    expect(canAccessConnection(perUserCtx, "user-1")).toBe(true);
    expect(canAccessConnection(perUserCtx, "user-2")).toBe(false);
    expect(canAccessConnection(perUserCtx, null)).toBe(false);
  });
});
