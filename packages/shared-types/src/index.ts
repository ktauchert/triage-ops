export const VCS_PROVIDERS = {
  GITLAB: "GITLAB",
  GITHUB: "GITHUB",
} as const;

export type VcsProvider = (typeof VCS_PROVIDERS)[keyof typeof VCS_PROVIDERS];

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
  milestone: {
    id: number;
    title: string;
    due_date?: string | null;
    state?: "active" | "closed";
  } | null;
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

export type GitHubIssueRaw = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  user: { login: string };
  assignee: { login: string } | null;
  labels: Array<{ name: string }>;
  milestone: {
    id: number;
    title: string;
    due_on: string | null;
    state: "open" | "closed";
  } | null;
  pull_request?: { url: string };
};

export type GitHubIssuesPage = {
  issues: GitHubIssueRaw[];
  hasNextPage: boolean;
  currentPage: number;
};

export type FetchGitHubIssuesParams = {
  accessToken: string;
  owner: string;
  repo: string;
  baseUrl?: string;
  page?: number;
  perPage?: number;
};

export type NormalizedIssue = {
  externalIssueId: number;
  issueNumber: number;
  title: string;
  description: string | null;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  authorUsername: string;
  assigneeUsername: string | null;
  weight: number | null;
  milestone: {
    externalId: number;
    title: string;
    dueDate: string | null;
    state: "open" | "closed";
  } | null;
};

export const DEFAULT_GITHUB_API_URL = "https://api.github.com";
