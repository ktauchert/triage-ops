/**
 * Seed a GitLab project with milestones and issues for TriageOps local testing.
 *
 * Usage (from repo root):
 *   npm run gitlab:seed
 *
 * Environment:
 *   GITLAB_URL              Base URL (default: http://gitlab.local)
 *   GITLAB_TOKEN            PAT with `api` scope (required)
 *   GITLAB_PROJECT_PATH     e.g. triage-test/demo (or set GITLAB_PROJECT_ID)
 *   GITLAB_PROJECT_ID       Numeric project id (optional if path is set)
 *   GITLAB_CONTAINER        Docker container name for backdating (default: gitlab)
 *   GITLAB_BACKDATE         Set to "false" to skip timestamp backdating (default: true)
 *
 * Also accepts SEED_GITLAB_* aliases from packages/db/src/seed.ts.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GHOST_DAYS = 30;
const ZOMBIE_DAYS = 14;

type GitLabMilestone = {
  id: number;
  title: string;
  due_date: string | null;
  state: string;
};

type GitLabIssue = {
  id: number;
  iid: number;
  title: string;
  state: string;
};

type IssueSeed = {
  key: string;
  title: string;
  description?: string | null;
  milestoneKey?: string;
  assignee?: boolean;
  close?: boolean;
  /** Days before now for updated_at / created_at (applied via rails runner). */
  ageDays?: number;
  weight?: number;
  labels?: string[];
};

type MilestoneSeed = {
  key: string;
  title: string;
  dueDaysFromNow: number;
  close?: boolean;
};

type CreatedIssue = IssueSeed & {
  iid: number;
  id: number;
};

function env(name: string, fallback?: string): string | undefined {
  const aliases: Record<string, string[]> = {
    GITLAB_URL: ["SEED_GITLAB_BASE_URL", "SEED_GITLAB_URL"],
    GITLAB_TOKEN: ["SEED_GITLAB_TOKEN"],
    GITLAB_PROJECT_PATH: ["SEED_GITLAB_PROJECT_PATH"],
    GITLAB_PROJECT_ID: ["SEED_GITLAB_PROJECT_ID"],
  };

  for (const key of aliases[name] ?? [`SEED_${name}`]) {
    const value = process.env[key];
    if (value?.trim()) {
      return value.trim();
    }
  }

  const value = process.env[name];
  if (value?.trim()) {
    return value.trim();
  }
  return fallback;
}

function requireEnv(name: string, fallback?: string): string {
  const value = env(name, fallback);
  if (!value) {
    throw new Error(
      `Missing ${name}. Set GITLAB_TOKEN (PAT with api scope) and GITLAB_PROJECT_PATH.`,
    );
  }
  return value;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function reproductionBody(params: {
  area: string;
  symptom: string;
  expected: string;
  actual: string;
}): string {
  return `## Steps to reproduce
1. Open the application
2. Navigate to ${params.area}
3. Observe the behaviour

## Expected
${params.expected}

## Actual
${params.actual}

## Notes
Reported during routine QA. Reproduces consistently on the staging environment.`;
}

const MILESTONES: MilestoneSeed[] = [
  {
    key: "overdue",
    title: "Sprint 12 (overdue)",
    dueDaysFromNow: -60,
  },
  {
    key: "future",
    title: "Sprint 13 (upcoming)",
    dueDaysFromNow: 30,
  },
  {
    key: "closed",
    title: "Sprint 11 (closed)",
    dueDaysFromNow: -90,
    close: true,
  },
];

const ISSUES: IssueSeed[] = [
  // Milestone decay — open issues on overdue sprint
  {
    key: "decay-open-1",
    title: "Checkout API times out after 30 seconds",
    milestoneKey: "overdue",
    description: reproductionBody({
      area: "Checkout → Payment",
      symptom: "the request spinner never completes",
      expected: "Order is placed and confirmation is shown",
      actual: "Request times out with HTTP 504 after ~30s",
    }),
    ageDays: 5,
    weight: 3,
    labels: ["bug", "checkout"],
  },
  {
    key: "decay-open-2",
    title: "Payment gateway timeout during checkout flow",
    milestoneKey: "overdue",
    description: reproductionBody({
      area: "Checkout → Payment",
      symptom: "the payment step hangs until the browser times out",
      expected: "Payment is processed and user sees confirmation",
      actual: "Gateway call times out after ~30 seconds with no error toast",
    }),
    ageDays: 8,
    weight: 5,
    labels: ["bug", "checkout"],
  },
  {
    key: "decay-closed",
    title: "Checkout spinner stuck on success page",
    milestoneKey: "overdue",
    description: reproductionBody({
      area: "Checkout → Confirmation",
      symptom: "spinner remains visible after payment succeeds",
      expected: "Confirmation page renders without loading state",
      actual: "Spinner never disappears although order ID is returned",
    }),
    close: true,
    ageDays: 12,
    labels: ["bug", "checkout"],
  },

  // Healthy work on upcoming milestone
  {
    key: "healthy-active",
    title: "Add retry banner when checkout is slow",
    milestoneKey: "future",
    assignee: true,
    description:
      "Show a non-blocking banner when checkout latency exceeds 5 seconds.",
    ageDays: 2,
    weight: 2,
    labels: ["enhancement"],
  },

  // Closed milestone — appears after sync without affecting triage counts
  {
    key: "closed-milestone",
    title: "Archive sprint 11 release notes",
    milestoneKey: "closed",
    close: true,
    description: "Document completed work from the closed sprint.",
    ageDays: 95,
    labels: ["chore"],
  },

  // Zombie — assigned, no milestone, stale
  {
    key: "zombie-1",
    title: "Password reset email never arrives",
    assignee: true,
    description: reproductionBody({
      area: "Login → Forgot password",
      symptom: "no email is received within 15 minutes",
      expected: "Reset email is delivered promptly",
      actual: "No email in inbox or spam; mail logs show no outbound message",
    }),
    ageDays: ZOMBIE_DAYS + 6,
    labels: ["bug", "auth"],
  },
  {
    key: "zombie-2",
    title: "Users do not receive password recovery mail",
    assignee: true,
    description: reproductionBody({
      area: "Account recovery",
      symptom: "recovery email is missing after multiple attempts",
      expected: "User receives password reset link by email",
      actual: "No recovery email is sent; support sees empty mail queue entries",
    }),
    ageDays: ZOMBIE_DAYS + 10,
    labels: ["bug", "auth"],
  },

  // Ghost — unassigned, stale
  {
    key: "ghost-1",
    title: "Dashboard loads slowly on mobile Safari",
    description: reproductionBody({
      area: "Dashboard on iOS Safari",
      symptom: "first paint takes more than 8 seconds",
      expected: "Dashboard becomes interactive within 2 seconds",
      actual: "Blank screen for several seconds; charts load very late",
    }),
    ageDays: GHOST_DAYS + 15,
    labels: ["performance", "mobile"],
  },
  {
    key: "ghost-2",
    title: "Mobile dashboard performance regression on Safari",
    description: reproductionBody({
      area: "Dashboard (mobile web)",
      symptom: "page feels frozen while metrics widgets load",
      expected: "Dashboard is usable immediately after navigation",
      actual: "Long white screen on Safari iOS; widgets pop in one by one",
    }),
    ageDays: GHOST_DAYS + 20,
    labels: ["performance", "mobile"],
  },

  // LLM duplicate candidates — similar wording, open
  {
    key: "dup-login-a",
    title: "Login fails with 500 when using SSO",
    milestoneKey: "future",
    description: reproductionBody({
      area: "Login → SSO",
      symptom: "SSO callback returns internal server error",
      expected: "User is signed in via corporate IdP",
      actual: "HTTP 500 on /oauth/callback with generic error page",
    }),
    ageDays: 4,
    labels: ["bug", "auth", "sso"],
  },
  {
    key: "dup-login-b",
    title: "SSO login returns internal server error",
    milestoneKey: "future",
    description: reproductionBody({
      area: "Single sign-on",
      symptom: "authentication fails after IdP redirect",
      expected: "Successful login and redirect to home",
      actual: "500 error displayed immediately after SSO callback",
    }),
    ageDays: 3,
    labels: ["bug", "auth", "sso"],
  },
  {
    key: "dup-export-a",
    title: "Export CSV missing date column",
    description: reproductionBody({
      area: "Issues → Export CSV",
      symptom: "downloaded file omits created date",
      expected: "CSV includes created_at for each row",
      actual: "Date column is absent from header and rows",
    }),
    ageDays: 6,
    labels: ["bug", "export"],
  },
  {
    key: "dup-export-b",
    title: "CSV export does not include created date field",
    description: reproductionBody({
      area: "Export",
      symptom: "created timestamp missing from spreadsheet",
      expected: "Export contains a created date column",
      actual: "CSV rows have title and state only; no created date",
    }),
    ageDays: 7,
    labels: ["bug", "export"],
  },
  {
    key: "dup-webhook-a",
    title: "Webhook retries fail silently",
    description: reproductionBody({
      area: "Project → Webhooks",
      symptom: "failed deliveries are not retried",
      expected: "GitLab retries webhook on 5xx responses",
      actual: "Single attempt logged; no retry schedule created",
    }),
    ageDays: 9,
    labels: ["bug", "integrations"],
  },
  {
    key: "dup-webhook-b",
    title: "Outgoing webhooks stop retrying after first failure",
    description: reproductionBody({
      area: "Webhook settings",
      symptom: "endpoint blip causes permanent failure",
      expected: "Automatic retries with backoff",
      actual: "Only one delivery attempt; status stays failed",
    }),
    ageDays: 10,
    labels: ["bug", "integrations"],
  },

  // Empty descriptions — future LLM draft targets
  {
    key: "empty-desc-1",
    title: "Add pagination to issues list",
    milestoneKey: "future",
    description: null,
    ageDays: 1,
    labels: ["enhancement"],
  },
  {
    key: "empty-desc-2",
    title: "Support dark mode in user settings",
    description: null,
    ageDays: 1,
    labels: ["enhancement", "ux"],
  },
  {
    key: "empty-desc-3",
    title: "Show milestone burndown on project dashboard",
    description: "",
    ageDays: 2,
    labels: ["enhancement", "metrics"],
  },

  // Negative controls — similar topics but should not pair as duplicates
  {
    key: "neg-login-a",
    title: "Improve login page loading spinner",
    description: reproductionBody({
      area: "Login UI",
      symptom: "spinner flashes too briefly on fast networks",
      expected: "Smooth loading indicator during auth check",
      actual: "Spinner disappears before content paints",
    }),
    ageDays: 5,
    labels: ["ux", "auth"],
  },
  {
    key: "neg-export-a",
    title: "Add PDF export for issue reports",
    description: reproductionBody({
      area: "Issues → Export",
      symptom: "users request printable summaries",
      expected: "PDF export option alongside CSV",
      actual: "Only CSV export is available today",
    }),
    ageDays: 8,
    labels: ["enhancement", "export"],
  },
];

type GitLabProject = {
  id: number;
  path_with_namespace: string;
  permissions?: {
    project_access?: { access_level: number } | null;
    group_access?: { access_level: number } | null;
  };
};

/** GitLab access level: Developer or above can create issues/milestones. */
const GITLAB_DEVELOPER_ACCESS = 30;

class GitLabApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "GitLabApiError";
  }
}

function projectAccessLevel(project: GitLabProject): number {
  const direct = project.permissions?.project_access?.access_level ?? 0;
  const inherited = project.permissions?.group_access?.access_level ?? 0;
  return Math.max(direct, inherited);
}

class GitLabClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`/api/v4${path}`, `${this.baseUrl.replace(/\/$/, "")}/`);
    const response = await fetch(url, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new GitLabApiError(
        `${method} ${path} failed with status ${response.status}`,
        response.status,
        text,
      );
    }

    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  getCurrentUserId(): Promise<number> {
    return this.request<{ id: number }>("GET", "/user").then((user) => user.id);
  }

  async resolveProjectId(projectPath?: string, projectId?: number): Promise<number> {
    const project = await this.getProject(projectPath, projectId);
    return project.id;
  }

  async getProject(
    projectPath?: string,
    projectId?: number,
  ): Promise<GitLabProject> {
    if (projectId && projectId > 0) {
      return this.request<GitLabProject>("GET", `/projects/${projectId}`);
    }
    if (!projectPath) {
      throw new Error("Set GITLAB_PROJECT_PATH or GITLAB_PROJECT_ID");
    }
    const encoded = encodeURIComponent(projectPath);
    return this.request<GitLabProject>("GET", `/projects/${encoded}`);
  }

  async assertCanWrite(project: GitLabProject): Promise<void> {
    const level = projectAccessLevel(project);
    if (level >= GITLAB_DEVELOPER_ACCESS) {
      return;
    }

    throw new Error(
      [
        `Insufficient access to ${project.path_with_namespace} (id ${project.id}).`,
        `Effective access level is ${level}; Developer (${GITLAB_DEVELOPER_ACCESS}) or higher is required.`,
        "Add the token user as Developer on the project, or use a PAT with the `api` scope.",
      ].join("\n"),
    );
  }

  createMilestone(
    projectId: number,
    seed: MilestoneSeed,
  ): Promise<GitLabMilestone> {
    return this.request<GitLabMilestone>("POST", `/projects/${projectId}/milestones`, {
      title: seed.title,
      due_date: daysFromNow(seed.dueDaysFromNow),
    });
  }

  closeMilestone(projectId: number, milestoneId: number): Promise<void> {
    return this.request("PUT", `/projects/${projectId}/milestones/${milestoneId}`, {
      state_event: "close",
    });
  }

  createIssue(
    projectId: number,
    seed: IssueSeed,
    milestoneId: number | undefined,
    assigneeId: number | undefined,
  ): Promise<GitLabIssue> {
    const payload: Record<string, unknown> = {
      title: seed.title,
    };

    if (seed.description !== undefined && seed.description !== null) {
      payload.description = seed.description;
    }

    if (milestoneId !== undefined) {
      payload.milestone_id = milestoneId;
    }

    if (assigneeId !== undefined) {
      payload.assignee_ids = [assigneeId];
    }

    if (seed.weight !== undefined) {
      payload.weight = seed.weight;
    }

    if (seed.labels?.length) {
      payload.labels = seed.labels.join(",");
    }

    return this.request<GitLabIssue>("POST", `/projects/${projectId}/issues`, payload);
  }

  closeIssue(projectId: number, issueIid: number): Promise<void> {
    return this.request("PUT", `/projects/${projectId}/issues/${issueIid}`, {
      state_event: "close",
    });
  }
}

async function backdateIssues(
  container: string,
  projectPath: string,
  created: CreatedIssue[],
): Promise<void> {
  const entries = created
    .filter((issue) => issue.ageDays !== undefined)
    .map((issue) => ({
      iid: issue.iid,
      updated_at: daysAgo(issue.ageDays!),
      created_at: daysAgo(issue.ageDays! + 3),
    }));

  if (entries.length === 0) {
    return;
  }

  const ruby = [
    'require "json"',
    'data = JSON.parse(ENV.fetch("SEED_BACKDATES"))',
    'project = Project.find_by_full_path(ENV.fetch("SEED_PROJECT_PATH"))',
    'raise "Project not found: " + ENV.fetch("SEED_PROJECT_PATH") unless project',
    "updated = 0",
    'data.each do |entry|',
    '  issue = project.issues.find_by(iid: entry["iid"])',
    "  next unless issue",
    "  issue.update_columns(",
    '    updated_at: Time.zone.parse(entry["updated_at"]),',
    '    created_at: Time.zone.parse(entry["created_at"])',
    "  )",
    "  updated += 1",
    "end",
    'puts "Backdated #{updated} issue(s)"',
  ].join("\n");

  await execFileAsync("docker", [
    "exec",
    "-e",
    `SEED_BACKDATES=${JSON.stringify(entries)}`,
    "-e",
    `SEED_PROJECT_PATH=${projectPath}`,
    container,
    "gitlab-rails",
    "runner",
    ruby,
  ]);

  console.log(`Backdated ${entries.length} issue timestamp(s) via ${container}`);
}

async function main(): Promise<void> {
  const baseUrl = requireEnv("GITLAB_URL", "http://gitlab.local");
  const token = requireEnv("GITLAB_TOKEN");
  const projectPath = env("GITLAB_PROJECT_PATH");
  const projectIdRaw = env("GITLAB_PROJECT_ID");
  const projectId = projectIdRaw ? Number.parseInt(projectIdRaw, 10) : undefined;
  const container = env("GITLAB_CONTAINER", "gitlab") ?? "gitlab";
  const backdateEnabled = env("GITLAB_BACKDATE", "true") !== "false";

  const client = new GitLabClient(baseUrl, token);
  const project = await client.getProject(projectPath, projectId);
  await client.assertCanWrite(project);
  const resolvedProjectId = project.id;
  const assigneeId = await client.getCurrentUserId();

  console.log(
    `Seeding GitLab project ${project.path_with_namespace} (id ${resolvedProjectId}) at ${baseUrl}`,
  );

  const milestoneIds = new Map<string, number>();

  for (const milestone of MILESTONES) {
    const created = await client.createMilestone(resolvedProjectId, milestone);
    milestoneIds.set(milestone.key, created.id);
    console.log(`  milestone: ${milestone.title} (id ${created.id})`);

    if (milestone.close) {
      await client.closeMilestone(resolvedProjectId, created.id);
      console.log(`    closed milestone ${milestone.title}`);
    }
  }

  const createdIssues: CreatedIssue[] = [];

  for (const seed of ISSUES) {
    const milestoneId =
      seed.milestoneKey !== undefined
        ? milestoneIds.get(seed.milestoneKey)
        : undefined;

    if (seed.milestoneKey && milestoneId === undefined) {
      throw new Error(`Unknown milestone key: ${seed.milestoneKey}`);
    }

    const issue = await client.createIssue(
      resolvedProjectId,
      seed,
      milestoneId,
      seed.assignee ? assigneeId : undefined,
    );

    if (seed.close) {
      await client.closeIssue(resolvedProjectId, issue.iid);
    }

    createdIssues.push({
      ...seed,
      iid: issue.iid,
      id: issue.id,
    });

    console.log(`  issue #${issue.iid}: ${seed.title}`);
  }

  if (backdateEnabled) {
    const backdatePath = projectPath ?? project.path_with_namespace;
    if (!backdatePath) {
      console.warn(
        "Skipping backdate: project path is required for rails runner (set GITLAB_BACKDATE=false to silence).",
      );
    } else {
      try {
        await backdateIssues(container, backdatePath, createdIssues);
      } catch (error) {
        console.warn(
          "Could not backdate issue timestamps via docker. Issues were created but updated_at is still recent.",
        );
        console.warn(
          "Ensure the gitlab container is named correctly (GITLAB_CONTAINER) or set GITLAB_BACKDATE=false.",
        );
        if (error instanceof Error) {
          console.warn(error.message);
        }
      }
    }
  }

  console.log("\nSeed complete.");
  console.log("\nDashboard metrics (after sync in TriageOps):");
  console.log(`  milestone decay: 1 overdue sprint with 2 open issues`);
  console.log(`  zombie issues:   2 (assigned, no milestone, >${ZOMBIE_DAYS}d stale)`);
  console.log(`  ghost issues:    2 (unassigned, >${GHOST_DAYS}d stale)`);
  console.log(`  labels:          synced from GitLab on re-sync`);
  console.log("\nLLM test data (dashboard → Run analysis):");
  console.log(`  duplicate pairs: 3 pairs with similar titles/descriptions`);
  console.log(`  negative ctrl:   2 similar-topic issues that should not pair`);
  console.log(`  empty desc:      3 issues for description drafting`);
  console.log("\nRegister the project in TriageOps and run sync to import issues and labels.");
}

main().catch((error: unknown) => {
  if (error instanceof GitLabApiError) {
    console.error(error.message);
    console.error(error.body);
    if (error.status === 403) {
      console.error(
        [
          "",
          "Hint: seeding requires write access. Most often this means:",
          "  • PAT scope must be `api` (not `read_api` — that scope is read-only).",
          "  • Token user must be Developer or higher on the target project.",
          "",
          "Create a separate seed token at:",
          "  http://gitlab.local/-/user_settings/personal_access_tokens",
        ].join("\n"),
      );
    }
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
