export const QUEUE_NAMES = {
  GITLAB_SYNC: "gitlab-sync",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type SyncJobPayload = {
  projectId: string;
  syncRunId: string;
};

export type GitLabIssueRaw = {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  state: "opened" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author: { username: string };
  assignee: { username: string } | null;
  labels: string[];
  weight: number | null;
  milestone: { id: number; title: string } | null;
};

export type GitLabIssuesPage = {
  issues: GitLabIssueRaw[];
  totalPages: number;
  currentPage: number;
};

export type FetchGitLabIssuesParams = {
  baseUrl: string;
  accessToken: string;
  gitlabProjectId: number;
  page?: number;
  perPage?: number;
};
