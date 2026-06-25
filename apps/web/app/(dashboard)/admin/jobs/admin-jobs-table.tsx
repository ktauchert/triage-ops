"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminBackgroundJob } from "@/lib/services/admin";
import { formatRelativeDate } from "@/lib/utils";

type JobFilter = "all" | "failed" | "running";

function jobKindLabel(kind: AdminBackgroundJob["kind"]): string {
  switch (kind) {
    case "sync":
      return "Sync";
    case "analysis":
      return "Analysis";
    case "writeback":
      return "Write-back";
  }
}

function isRunningJob(job: AdminBackgroundJob): boolean {
  return job.status === "PENDING" || job.status === "RUNNING" || job.status === "APPLYING";
}

function isFailedJob(job: AdminBackgroundJob): boolean {
  return job.status === "FAILED" || job.status === "APPLY_FAILED";
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED" || status === "APPLY_FAILED") {
    return "destructive";
  }

  if (status === "COMPLETED" || status === "APPLIED") {
    return "default";
  }

  if (status === "PENDING" || status === "RUNNING" || status === "APPLYING") {
    return "secondary";
  }

  return "outline";
}

export function AdminJobsTable({
  jobs,
  initialFilter = "all",
}: {
  jobs: AdminBackgroundJob[];
  initialFilter?: JobFilter;
}) {
  const [filter, setFilter] = useState<JobFilter>(initialFilter);

  const filteredJobs = useMemo(() => {
    if (filter === "failed") {
      return jobs.filter(isFailedJob);
    }

    if (filter === "running") {
      return jobs.filter(isRunningJob);
    }

    return jobs;
  }, [filter, jobs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["running", "Running"],
            ["failed", "Failed"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filteredJobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No background jobs match this filter.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => (
              <TableRow key={`${job.kind}-${job.id}`}>
                <TableCell>
                  <Badge variant="outline">{jobKindLabel(job.kind)}</Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/project/${job.projectId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {job.projectName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {job.errorMessage
                    ? job.errorMessage
                    : [job.detail, job.appliedByEmail ? `by ${job.appliedByEmail}` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatRelativeDate(job.startedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
