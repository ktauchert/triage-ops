"use client";

import { Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { cn, formatRelativeDate, syncStatusColor } from "@/lib/utils";

type SyncRun = {
  id: string;
  status: string;
  startedAt: Date | string;
  completedAt: Date | string | null;
  issuesSynced: number;
  errorMessage: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  pathWithNamespace: string;
  isFavorite: boolean;
  lastSyncedAt: Date | string | null;
  connection: { id: string; name: string; baseUrl: string };
  syncRuns: SyncRun[];
};

const TERMINAL_SYNC_STATUSES = new Set(["COMPLETED", "FAILED"]);
const SYNC_POLL_INTERVAL_MS = 500;
const SYNC_POLL_TIMEOUT_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSyncRun(
  projectId: string,
  syncRunId: string,
  onStatus?: (status: string) => void,
) {
  const deadline = Date.now() + SYNC_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(`/api/projects/${projectId}/sync-runs`);
    const data = (await response.json()) as {
      error?: string;
      syncRuns?: SyncRun[];
    };

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to fetch sync status");
    }

    const run = data.syncRuns?.find((entry) => entry.id === syncRunId);
    if (run) {
      onStatus?.(run.status);
      if (TERMINAL_SYNC_STATUSES.has(run.status)) {
        return run;
      }
    }

    await sleep(SYNC_POLL_INTERVAL_MS);
  }

  throw new Error("Sync is taking longer than expected. Refresh the page to check status.");
}

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [liveRunStatus, setLiveRunStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleFavorite(project: ProjectRow) {
    setBusyProjectId(project.id);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !project.isFavorite }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update favorite");
      }

      router.refresh();
    } catch (favoriteError) {
      setError(
        favoriteError instanceof Error
          ? favoriteError.message
          : "Failed to update favorite",
      );
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleDelete(project: ProjectRow) {
    if (
      !window.confirm(
        `Delete project "${project.name}"? Synced issues and metrics for this repo will be removed.`,
      )
    ) {
      return;
    }

    setBusyProjectId(project.id);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete project");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete project",
      );
    } finally {
      setBusyProjectId(null);
    }
  }

  async function handleSync(projectId: string) {
    setSyncingProjectId(projectId);
    setLiveRunStatus((current) => ({ ...current, [projectId]: "PENDING" }));
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });

      const data = (await response.json()) as {
        error?: string;
        syncRun?: { id: string; status: string };
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to enqueue sync");
      }

      if (!data.syncRun?.id) {
        throw new Error("Sync started without a run id");
      }

      setLiveRunStatus((current) => ({
        ...current,
        [projectId]: data.syncRun?.status ?? "PENDING",
      }));

      const completedRun = await waitForSyncRun(
        projectId,
        data.syncRun.id,
        (status) => {
          setLiveRunStatus((current) => ({ ...current, [projectId]: status }));
        },
      );

      if (completedRun.status === "FAILED") {
        throw new Error(completedRun.errorMessage ?? "Sync failed");
      }

      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Failed to sync project",
      );
      setLiveRunStatus((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      router.refresh();
    } finally {
      setSyncingProjectId(null);
    }
  }

  return (
    <>
      {error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Registered projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Project</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Latest run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => {
                  const latestRun = project.syncRuns[0];
                  const displayStatus =
                    liveRunStatus[project.id] ?? latestRun?.status;
                  const rowBusy =
                    busyProjectId === project.id || syncingProjectId === project.id;

                  return (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0"
                          disabled={rowBusy}
                          onClick={() => handleFavorite(project)}
                          aria-label={
                            project.isFavorite
                              ? "Remove favorite"
                              : "Mark as favorite"
                          }
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              project.isFavorite
                                ? "fill-amber-400 text-amber-500"
                                : "text-muted-foreground",
                            )}
                          />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {project.pathWithNamespace}
                        </div>
                      </TableCell>
                      <TableCell>{project.connection.name}</TableCell>
                      <TableCell>
                        {formatRelativeDate(project.lastSyncedAt)}
                      </TableCell>
                      <TableCell>
                        {displayStatus ? (
                          <Badge variant={syncStatusColor(displayStatus)}>
                            {displayStatus}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSync(project.id)}
                            disabled={rowBusy}
                          >
                            {syncingProjectId === project.id
                              ? "Syncing..."
                              : "Sync"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={rowBusy}
                            onClick={() => handleDelete(project)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
