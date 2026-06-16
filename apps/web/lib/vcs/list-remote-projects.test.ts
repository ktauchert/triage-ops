import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { listRemoteProjects } from "./list-remote-projects";
import { VcsProvider } from "@triage-ops/db";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("listRemoteProjects", () => {
  it("maps GitHub repositories", async () => {
    server.use(
      http.get("https://api.github.com/user/repos", () =>
        HttpResponse.json([
          {
            id: 1,
            name: "widgets",
            full_name: "acme/widgets",
            private: false,
          },
        ]),
      ),
    );

    const projects = await listRemoteProjects({
      provider: VcsProvider.GITHUB,
      baseUrl: "https://api.github.com",
      accessToken: "ghp-test",
    });

    expect(projects).toEqual([
      {
        externalProjectId: null,
        pathWithNamespace: "acme/widgets",
        name: "widgets",
      },
    ]);
  });

  it("maps GitLab projects", async () => {
    server.use(
      http.get("https://gitlab.example.com/api/v4/projects", () =>
        HttpResponse.json([
          {
            id: 42,
            name: "Sample",
            path_with_namespace: "group/sample",
          },
        ], {
          headers: { "x-total-pages": "1" },
        }),
      ),
    );

    const projects = await listRemoteProjects({
      provider: VcsProvider.GITLAB,
      baseUrl: "https://gitlab.example.com",
      accessToken: "glpat-test",
    });

    expect(projects).toEqual([
      {
        externalProjectId: 42,
        pathWithNamespace: "group/sample",
        name: "Sample",
      },
    ]);
  });

  it("returns a scope hint for GitHub 403 responses", async () => {
    server.use(
      http.get("https://api.github.com/user/repos", () =>
        new HttpResponse("Forbidden", { status: 403 }),
      ),
    );

    await expect(
      listRemoteProjects({
        provider: VcsProvider.GITHUB,
        baseUrl: "https://api.github.com",
        accessToken: "ghp-test",
      }),
    ).rejects.toThrow(/repo scope/i);
  });

  it("returns a scope hint for GitLab 403 responses", async () => {
    server.use(
      http.get("https://gitlab.example.com/api/v4/projects", () =>
        new HttpResponse("Forbidden", { status: 403 }),
      ),
    );

    await expect(
      listRemoteProjects({
        provider: VcsProvider.GITLAB,
        baseUrl: "https://gitlab.example.com",
        accessToken: "glpat-test",
      }),
    ).rejects.toThrow(/read_api/i);
  });
});
