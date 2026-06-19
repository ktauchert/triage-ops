"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type SuggestionIssue = {
  id: string;
  gitlabIssueIid: number;
  title: string;
};

export type SuggestionRow = {
  id: string;
  type: "DUPLICATE" | "DESCRIPTION";
  status: "PENDING" | "DISMISSED" | "APPLIED";
  suggestedText: string | null;
  confidence: number | null;
  issue: SuggestionIssue;
  relatedIssue: SuggestionIssue | null;
};

type AnalysisRunSummary = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  suggestionsCreated: number;
  errorMessage: string | null;
} | null;

type SuggestionsPanelProps = {
  projectId: string;
  suggestions: SuggestionRow[];
  pendingCount: number;
  latestAnalysisRun: AnalysisRunSummary;
};

export function SuggestionsPanel({
  projectId,
  suggestions,
  pendingCount,
  latestAnalysisRun,
}: SuggestionsPanelProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analysisInProgress =
    latestAnalysisRun?.status === "PENDING" ||
    latestAnalysisRun?.status === "RUNNING";

  async function runAnalysis() {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error ?? "Failed to start analysis");
      }

      router.refresh();
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Failed to start analysis",
      );
    } finally {
      setRunning(false);
    }
  }

  async function updateSuggestion(
    suggestionId: string,
    status: "DISMISSED" | "APPLIED",
  ) {
    setActingId(suggestionId);
    setError(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update suggestion");
      }

      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update suggestion",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            AI suggestions
            {pendingCount > 0 ? (
              <Badge variant="secondary">{pendingCount} pending</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Local Ollama analysis on synced issues. Apply marks suggestions
            reviewed in TriageOps only — no GitLab or GitHub write-back.
          </CardDescription>
        </div>
        <Button
          onClick={runAnalysis}
          disabled={running || analysisInProgress}
        >
          {running || analysisInProgress ? "Analyzing…" : "Run analysis"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {latestAnalysisRun ? (
          <p className="text-sm text-muted-foreground">
            Last run: {latestAnalysisRun.status.toLowerCase()}
            {latestAnalysisRun.suggestionsCreated > 0
              ? ` · ${latestAnalysisRun.suggestionsCreated} suggestion(s) created`
              : ""}
            {latestAnalysisRun.errorMessage
              ? ` · ${latestAnalysisRun.errorMessage}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No analysis runs yet. Sync issues first, then run analysis.
          </p>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending suggestions. Run analysis after syncing open issues.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Suggestion</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((suggestion) => (
                <TableRow key={suggestion.id}>
                  <TableCell>
                    <Badge variant="outline">{suggestion.type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="font-medium">
                      #{suggestion.issue.gitlabIssueIid}{" "}
                      {suggestion.issue.title}
                    </p>
                    {suggestion.relatedIssue ? (
                      <p className="text-sm text-muted-foreground">
                        ↔ #{suggestion.relatedIssue.gitlabIssueIid}{" "}
                        {suggestion.relatedIssue.title}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">
                    {suggestion.suggestedText ?? "—"}
                  </TableCell>
                  <TableCell>
                    {suggestion.confidence != null
                      ? `${Math.round(suggestion.confidence * 100)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actingId === suggestion.id}
                        onClick={() =>
                          updateSuggestion(suggestion.id, "DISMISSED")
                        }
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === suggestion.id}
                        onClick={() =>
                          updateSuggestion(suggestion.id, "APPLIED")
                        }
                      >
                        Apply
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
