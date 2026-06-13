"use client";

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
import { formatRelativeDate, syncStatusColor } from "@/lib/utils";

type SyncRun = {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  issuesSynced: number;
  errorMessage: string | null;
};

type ProjectRow = {
  id: string;
  name: string;
  pathWithNamespace: string;
  lastSyncedAt: Date | null;
  connection: { id: string; name: string; baseUrl: string };
  syncRuns: SyncRun[];
};

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync(projectId: string) {
    setSyncingProjectId(projectId);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to enqueue sync");
      }

      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error ? syncError.message : "Failed to sync project",
      );
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

                  return (
                    <TableRow key={project.id}>
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
                        {latestRun ? (
                          <Badge variant={syncStatusColor(latestRun.status)}>
                            {latestRun.status}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleSync(project.id)}
                          disabled={syncingProjectId === project.id}
                        >
                          {syncingProjectId === project.id
                            ? "Syncing..."
                            : "Sync"}
                        </Button>
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
