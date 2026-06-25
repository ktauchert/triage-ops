import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const server = setupServer();

export function gitlabIssuesHandler(
  projectId: number,
  issues: unknown[],
  totalPages = 1,
  currentPage = 1,
) {
  return http.get(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues`,
    ({ request }) => {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get("page") ?? "1", 10);

      return HttpResponse.json(issues, {
        headers: {
          "x-total-pages": String(totalPages),
          "x-page": String(currentPage),
        },
      });
    },
  );
}

export function gitlabErrorHandler(projectId: number, status: number, body: string) {
  return http.get(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues`,
    () => new HttpResponse(body, { status }),
  );
}

export function gitlabIssueUpdateHandler(projectId: number, issueIid: number) {
  return http.put(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}`,
    () => HttpResponse.json({ iid: issueIid }),
  );
}

export function gitlabIssueNoteHandler(projectId: number, issueIid: number) {
  return http.post(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
    () => HttpResponse.json({ id: 1 }),
  );
}

export function gitlabIssueNotesListHandler(
  projectId: number,
  issueIid: number,
  bodies: string[] = [],
) {
  return http.get(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
    () => HttpResponse.json(bodies.map((body, index) => ({ id: index + 1, body }))),
  );
}

export function gitlabIssueGetHandler(
  projectId: number,
  issueIid: number,
  state = "opened",
) {
  return http.get(
    `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}`,
    () => HttpResponse.json({ iid: issueIid, state }),
  );
}

export function gitlabIssueWriteErrorHandler(
  projectId: number,
  issueIid: number,
  status: number,
  body: string,
) {
  return [
    http.put(
      `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}`,
      () => new HttpResponse(body, { status }),
    ),
    http.post(
      `https://gitlab.example.com/api/v4/projects/${projectId}/issues/${issueIid}/notes`,
      () => new HttpResponse(body, { status }),
    ),
  ];
}

export function githubIssuePatchHandler(owner: string, repo: string, issueNumber: number) {
  return http.patch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    () => HttpResponse.json({ number: issueNumber }),
  );
}

export function githubIssuePatchErrorHandler(
  owner: string,
  repo: string,
  issueNumber: number,
  status: number,
  body: string,
) {
  return http.patch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    () => new HttpResponse(body, { status }),
  );
}

export function githubIssueCommentHandler(
  owner: string,
  repo: string,
  issueNumber: number,
) {
  return http.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    () => HttpResponse.json({ id: 1 }),
  );
}

export function githubIssueCommentsListHandler(
  owner: string,
  repo: string,
  issueNumber: number,
  bodies: string[] = [],
) {
  return http.get(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    () => HttpResponse.json(bodies.map((body, index) => ({ id: index + 1, body }))),
  );
}

export function githubIssueGetHandler(
  owner: string,
  repo: string,
  issueNumber: number,
  state = "open",
) {
  return http.get(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    () => HttpResponse.json({ number: issueNumber, state }),
  );
}

export function githubIssueCommentErrorHandler(
  owner: string,
  repo: string,
  issueNumber: number,
  status: number,
  body: string,
) {
  return http.post(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    () => new HttpResponse(body, { status }),
  );
}

export function githubIssuesHandler(
  owner: string,
  repo: string,
  issues: unknown[],
  options: { hasNextPage?: boolean } = {},
) {
  return http.get(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    () =>
      HttpResponse.json(issues, {
        headers: options.hasNextPage
          ? {
              link: `<https://api.github.com/repos/${owner}/${repo}/issues?page=2>; rel="next"`,
            }
          : {},
      }),
  );
}

export function githubErrorHandler(
  owner: string,
  repo: string,
  status: number,
  body: string,
) {
  return http.get(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    () => new HttpResponse(body, { status }),
  );
}

const OLLAMA_HOST = "http://localhost:11434";

export function ollamaTagsHandler(modelNames: string[]) {
  return http.get(`${OLLAMA_HOST}/api/tags`, () =>
    HttpResponse.json({
      models: modelNames.map((name) => ({ name })),
    }),
  );
}

export function ollamaChatHandler(content: string) {
  return http.post(`${OLLAMA_HOST}/api/chat`, () =>
    HttpResponse.json({
      message: { role: "assistant", content },
    }),
  );
}

export function ollamaEmbedHandler(embeddings: number[][]) {
  return http.post(`${OLLAMA_HOST}/api/embed`, () =>
    HttpResponse.json({ embeddings }),
  );
}

export function ollamaErrorHandler(path: string, status: number, body: string) {
  const method = path === "/api/tags" ? http.get : http.post;
  return method(`${OLLAMA_HOST}${path}`, () =>
    new HttpResponse(body, { status }),
  );
}
