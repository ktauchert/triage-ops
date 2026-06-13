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

type IssueSummary = {
  id: string;
  gitlabIssueIid: number;
  title: string;
  lastActivityAt: Date | null;
};

type MetricsPayload = {
  projectId: string;
  projectName: string;
  lastSyncedAt: Date | null;
  computedAt: string;
  thresholds: { ghostDays: number; zombieDays: number };
  ghost: { count: number; issues: IssueSummary[] };
  zombie: { count: number; issues: IssueSummary[] };
  milestoneDecay: {
    count: number;
    milestones: Array<{
      milestone: { id: string; title: string; dueDate: Date | null };
      openIssueCount: number;
      issues: IssueSummary[];
    }>;
  };
};

export function DashboardMetrics({
  metrics,
}: {
  metrics: MetricsPayload | null;
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Ghost tickets"
          description={`Open issues inactive for more than ${metrics.thresholds.ghostDays} days`}
          count={metrics.ghost.count}
        />
        <MetricCard
          title="Zombie tickets"
          description={`Assigned, no milestone, stale for ${metrics.thresholds.zombieDays}+ days`}
          count={metrics.zombie.count}
        />
        <MetricCard
          title="Milestone decay"
          description="Overdue active milestones with open issues"
          count={metrics.milestoneDecay.count}
        />
      </div>

      <IssueTable
        title="Ghost issues"
        issues={metrics.ghost.issues}
        emptyMessage="No ghost tickets found."
      />
      <IssueTable
        title="Zombie issues"
        issues={metrics.zombie.issues}
        emptyMessage="No zombie tickets found."
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
  description: string;
  count: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-4xl font-bold">{count}</p>
      </CardContent>
    </Card>
  );
}

function IssueTable({
  title,
  issues,
  emptyMessage,
  compact = false,
}: {
  title: string;
  issues: IssueSummary[];
  emptyMessage: string;
  compact?: boolean;
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
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell>{issue.gitlabIssueIid}</TableCell>
                <TableCell>{issue.title}</TableCell>
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
