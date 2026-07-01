import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeDate } from "@/lib/utils";
import { ThresholdSettings } from "./threshold-settings";
import { SuggestionsPanel } from "./suggestions-panel";
import type { RoleCapabilities } from "@/lib/auth/permissions";

type IssueSummary = {
  id: string;
  gitlabIssueIid: number;
  title: string;
  state?: string;
  labels?: string[];
  lastActivityAt: Date | null;
};

type MilestoneSummary = {
  id: string;
  title: string;
  state: string;
  dueDate: Date | null;
};

type MetricsPayload = {
  projectId: string;
  projectName: string;
  lastSyncedAt: Date | null;
  computedAt: string;
  thresholds: { staleDays: number; stuckDays: number };
  overview: {
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    totalMilestones: number;
    activeMilestones: number;
  };
  issues: IssueSummary[];
  milestones: MilestoneSummary[];
  stale: { count: number; issues: IssueSummary[] };
  stuck: { count: number; issues: IssueSummary[] };
  milestoneDecay: {
    count: number;
    milestones: Array<{
      milestone: { id: string; title: string; dueDate: Date | null };
      openIssueCount: number;
      issues: IssueSummary[];
    }>;
  };
  suggestions: {
    pendingCount: number;
    items: Array<{
      id: string;
      type: "DUPLICATE" | "DESCRIPTION";
      status: "PENDING" | "APPLYING" | "APPLY_FAILED" | "DISMISSED" | "APPLIED";
      suggestedText: string | null;
      confidence: number | null;
      writeBackError?: string | null;
      issue: { id: string; gitlabIssueIid: number; title: string };
      relatedIssue: {
        id: string;
        gitlabIssueIid: number;
        title: string;
      } | null;
    }>;
    latestAnalysisRun: {
      id: string;
      status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
      startedAt: Date;
      completedAt: Date | null;
      suggestionsCreated: number;
      totalSteps: number;
      completedSteps: number;
      progressLabel: string | null;
      errorMessage: string | null;
    } | null;
  };
};

export function DashboardMetrics({
  metrics,
  capabilities,
}: {
  metrics: MetricsPayload | null;
  capabilities: RoleCapabilities;
}) {
  if (!metrics) {
    return null;
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Last synced: {formatRelativeDate(metrics.lastSyncedAt)} · Computed:{" "}
        {formatRelativeDate(metrics.computedAt)}
      </p>

      <section className="space-y-3">
        <h3 className="section-heading">Overview</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Total issues" count={metrics.overview.totalIssues} />
          <MetricCard title="Open issues" count={metrics.overview.openIssues} />
          <MetricCard
            title="Closed issues"
            count={metrics.overview.closedIssues}
          />
          <MetricCard
            title="Milestones"
            count={metrics.overview.totalMilestones}
          />
          <MetricCard
            title="Active milestones"
            count={metrics.overview.activeMilestones}
          />
        </div>
      </section>

      <ThresholdSettings
        projectId={metrics.projectId}
        staleThresholdDays={metrics.thresholds.staleDays}
        stuckThresholdDays={metrics.thresholds.stuckDays}
        canEdit={capabilities.canEditSettings}
      />

      <SuggestionsPanel
        projectId={metrics.projectId}
        suggestions={metrics.suggestions.items}
        pendingCount={metrics.suggestions.pendingCount}
        canAnalyze={capabilities.canAnalyze}
        canApply={capabilities.canApply}
        canDismiss={capabilities.canDismiss}
        latestAnalysisRun={
          metrics.suggestions.latestAnalysisRun
            ? {
                ...metrics.suggestions.latestAnalysisRun,
                startedAt:
                  metrics.suggestions.latestAnalysisRun.startedAt.toISOString(),
                completedAt: metrics.suggestions.latestAnalysisRun.completedAt
                  ? metrics.suggestions.latestAnalysisRun.completedAt.toISOString()
                  : null,
              }
            : null
        }
      />

      <section className="space-y-3">
        <h3 className="section-heading">Signals</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Stale tickets"
            description={`Open issues inactive for more than ${metrics.thresholds.staleDays} days`}
            count={metrics.stale.count}
          />
          <MetricCard
            title="Stuck tickets"
            description={`Assigned, no milestone, inactive for ${metrics.thresholds.stuckDays}+ days`}
            count={metrics.stuck.count}
          />
          <MetricCard
            title="Milestone decay"
            description="Overdue active milestones with open issues"
            count={metrics.milestoneDecay.count}
          />
        </div>
      </section>

      <IssueTable
        title="All synced issues"
        issues={metrics.issues}
        showState
        showLabels
        emptyMessage="No issues synced yet. Run a sync from the Projects page."
      />

      <MilestoneTable
        milestones={metrics.milestones}
        emptyMessage="No milestones synced yet. Milestones appear when issues are linked to them on GitHub/GitLab."
      />

      <IssueTable
        title="Stale issues"
        issues={metrics.stale.issues}
        emptyMessage="Nothing quiet beyond your threshold."
      />
      <IssueTable
        title="Stuck issues"
        issues={metrics.stuck.issues}
        emptyMessage="Nothing blocked in place."
      />

      {metrics.milestoneDecay.milestones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Decayed milestones</CardTitle>
            <CardDescription>
              Active milestones past due date with open work remaining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.milestoneDecay.milestones.map((entry) => (
              <div key={entry.milestone.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{entry.milestone.title}</h3>
                  <Badge variant="secondary">{entry.openIssueCount} open</Badge>
                  <span className="text-sm text-muted-foreground">
                    Due {formatRelativeDate(entry.milestone.dueDate)}
                  </span>
                </div>
                <IssueTable
                  title=""
                  issues={entry.issues}
                  emptyMessage=""
                  compact
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function MetricCard({
  title,
  description,
  count,
}: {
  title: string;
  description?: string;
  count: number;
}) {
  return (
    <Card className="group hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5">
      <CardHeader className="pb-2">
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold tracking-tight tabular-nums">{count}</p>
      </CardContent>
    </Card>
  );
}

function MilestoneTable({
  milestones,
  emptyMessage,
}: {
  milestones: MilestoneSummary[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Synced milestones</CardTitle>
      </CardHeader>
      <CardContent>
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Due date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((milestone) => (
                <TableRow key={milestone.id}>
                  <TableCell>{milestone.title}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{milestone.state}</Badge>
                  </TableCell>
                  <TableCell>{formatRelativeDate(milestone.dueDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function IssueTable({
  title,
  issues,
  emptyMessage,
  compact = false,
  showState = false,
  showLabels = false,
}: {
  title: string;
  issues: IssueSummary[];
  emptyMessage: string;
  compact?: boolean;
  showState?: boolean;
  showLabels?: boolean;
}) {
  if (issues.length === 0 && emptyMessage) {
    return (
      <Card>
        {title ? (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        ) : null}
        <CardContent className="text-sm text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={compact ? "p-0" : undefined}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Title</TableHead>
              {showState ? <TableHead>State</TableHead> : null}
              {showLabels ? <TableHead>Labels</TableHead> : null}
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell>{issue.gitlabIssueIid}</TableCell>
                <TableCell>{issue.title}</TableCell>
                {showState ? (
                  <TableCell>
                    <Badge variant="secondary">{issue.state}</Badge>
                  </TableCell>
                ) : null}
                {showLabels ? (
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(issue.labels ?? []).length > 0 ? (
                        issue.labels?.map((label) => (
                          <Badge key={label} variant="outline">
                            {label}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                ) : null}
                <TableCell>
                  {formatRelativeDate(issue.lastActivityAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
