export type IssueState = "OPEN" | "CLOSED";

export type MilestoneState = "ACTIVE" | "CLOSED";

export type MetricIssue = {
  id: string;
  gitlabIssueIid: number;
  title: string;
  state: IssueState;
  assigneeUsername: string | null;
  lastActivityAt: Date | null;
  milestoneId: string | null;
};

export type MetricMilestone = {
  id: string;
  title: string;
  state: MilestoneState;
  dueDate: Date | null;
};

export type MetricIssueSummary = Pick<
  MetricIssue,
  "id" | "gitlabIssueIid" | "title" | "lastActivityAt"
>;

export type MilestoneDecayEntry = {
  milestone: Pick<MetricMilestone, "id" | "title" | "dueDate">;
  openIssueCount: number;
  issues: MetricIssueSummary[];
};

export type MetricThresholds = {
  staleDays: number;
  stuckDays: number;
};

export const DEFAULT_THRESHOLDS: MetricThresholds = {
  staleDays: 30,
  stuckDays: 14,
};
