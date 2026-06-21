"use client";

import { useEffect, useRef, useState } from "react";
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
import { previewMarkdownLines } from "@/lib/markdown-preview";
import { readResponseJson } from "@/lib/fetch-json";

type SuggestionIssue = {
  id: string;
  gitlabIssueIid: number;
  title: string;
};

export type SuggestionRow = {
  id: string;
  type: "DUPLICATE" | "DESCRIPTION";
  status: "PENDING" | "APPLYING" | "APPLY_FAILED" | "DISMISSED" | "APPLIED";
  suggestedText: string | null;
  confidence: number | null;
  writeBackError?: string | null;
  issue: SuggestionIssue;
  relatedIssue: SuggestionIssue | null;
};

type AnalysisRunSummary = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string | null;
  suggestionsCreated: number;
  totalSteps: number;
  completedSteps: number;
  progressLabel: string | null;
  errorMessage: string | null;
} | null;

type SuggestionsPanelProps = {
  projectId: string;
  suggestions: SuggestionRow[];
  pendingCount: number;
  latestAnalysisRun: AnalysisRunSummary;
  canAnalyze: boolean;
  canApply: boolean;
  canDismiss: boolean;
};

type AnalysisPanelResponse = {
  analysisRun: {
    id: string;
    status: AnalysisRunSummary extends null ? never : NonNullable<AnalysisRunSummary>["status"];
    startedAt: string;
    completedAt: string | null;
    suggestionsCreated: number;
    totalSteps: number;
    completedSteps: number;
    progressLabel: string | null;
    errorMessage: string | null;
  } | null;
  pendingCount: number;
  suggestions: SuggestionRow[];
};

const POLL_INTERVAL_MS = 1500;

function isAnalysisInProgress(run: AnalysisRunSummary): boolean {
  return run?.status === "PENDING" || run?.status === "RUNNING";
}

function hasApplyingSuggestions(suggestions: SuggestionRow[]): boolean {
  return suggestions.some((suggestion) => suggestion.status === "APPLYING");
}

function serializeAnalysisRun(
  run: AnalysisPanelResponse["analysisRun"],
): AnalysisRunSummary {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    startedAt:
      typeof run.startedAt === "string"
        ? run.startedAt
        : new Date(run.startedAt).toISOString(),
    completedAt: run.completedAt
      ? typeof run.completedAt === "string"
        ? run.completedAt
        : new Date(run.completedAt).toISOString()
      : null,
    suggestionsCreated: run.suggestionsCreated,
    totalSteps: run.totalSteps ?? 0,
    completedSteps: run.completedSteps ?? 0,
    progressLabel: run.progressLabel ?? null,
    errorMessage: run.errorMessage,
  };
}

function AnalysisProgressBar({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string | null;
}) {
  const percent =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium">{label ?? "Analyzing…"}</span>
        <span className="tabular-nums text-muted-foreground">
          {completed} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SuggestionTextCell({
  type,
  text,
}: {
  type: SuggestionRow["type"];
  text: string | null;
}) {
  if (!text) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (type === "DESCRIPTION") {
    return (
      <pre className="max-w-md whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
        {previewMarkdownLines(text, 3)}
      </pre>
    );
  }

  return <span className="block max-w-md truncate text-sm">{text}</span>;
}

export function SuggestionsPanel({
  projectId,
  suggestions,
  pendingCount,
  latestAnalysisRun,
  canAnalyze,
  canApply,
  canDismiss,
}: SuggestionsPanelProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveSuggestions, setLiveSuggestions] = useState(suggestions);
  const [livePendingCount, setLivePendingCount] = useState(pendingCount);
  const [liveAnalysisRun, setLiveAnalysisRun] =
    useState<AnalysisRunSummary>(latestAnalysisRun);
  const previousStatusRef = useRef(liveAnalysisRun?.status);
  const [syncedProps, setSyncedProps] = useState({
    suggestions,
    pendingCount,
    latestAnalysisRun,
  });

  if (
    !isAnalysisInProgress(latestAnalysisRun) &&
    (suggestions !== syncedProps.suggestions ||
      pendingCount !== syncedProps.pendingCount ||
      latestAnalysisRun !== syncedProps.latestAnalysisRun)
  ) {
    setSyncedProps({ suggestions, pendingCount, latestAnalysisRun });
    setLiveSuggestions(suggestions);
    setLivePendingCount(pendingCount);
    setLiveAnalysisRun(latestAnalysisRun);
  }

  const analysisInProgress = isAnalysisInProgress(liveAnalysisRun);
  const applyInProgress = hasApplyingSuggestions(liveSuggestions);

  useEffect(() => {
    if (!analysisInProgress) {
      return;
    }

    let cancelled = false;

    async function pollAnalysisPanel() {
      try {
        const response = await fetch(`/api/projects/${projectId}/analyze`);
        if (!response.ok || cancelled) {
          return;
        }

        const data = await readResponseJson<AnalysisPanelResponse>(response);
        if (!data || cancelled) {
          return;
        }

        setLiveAnalysisRun(serializeAnalysisRun(data.analysisRun));
        if (!isAnalysisInProgress(serializeAnalysisRun(data.analysisRun))) {
          setLiveSuggestions(data.suggestions);
          setLivePendingCount(data.pendingCount);
        }
      } catch {
        // Ignore transient network errors while polling.
      }
    }

    void pollAnalysisPanel();
    const interval = setInterval(() => {
      void pollAnalysisPanel();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [analysisInProgress, projectId]);

  useEffect(() => {
    if (!applyInProgress) {
      return;
    }

    let cancelled = false;

    async function pollSuggestionsPanel() {
      try {
        const response = await fetch(`/api/projects/${projectId}/analyze`);
        if (!response.ok || cancelled) {
          return;
        }

        const data = await readResponseJson<AnalysisPanelResponse>(response);
        if (!data || cancelled) {
          return;
        }

        setLiveSuggestions(data.suggestions);
        setLivePendingCount(data.pendingCount);

        if (!hasApplyingSuggestions(data.suggestions)) {
          router.refresh();
        }
      } catch {
        // Ignore transient network errors while polling.
      }
    }

    void pollSuggestionsPanel();
    const interval = setInterval(() => {
      void pollSuggestionsPanel();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [applyInProgress, projectId, router]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const currentStatus = liveAnalysisRun?.status;

    if (
      previousStatus !== currentStatus &&
      (currentStatus === "COMPLETED" || currentStatus === "FAILED")
    ) {
      router.refresh();
    }

    previousStatusRef.current = currentStatus;
  }, [liveAnalysisRun?.status, router]);

  async function runAnalysis() {
    setRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });
      const data = await readResponseJson<{
        error?: string;
        analysisRun?: AnalysisPanelResponse["analysisRun"];
      }>(response);

      if (!data) {
        throw new Error(
          "Empty response from server. Check that npm run dev and Redis are running.",
        );
      }

      if (!response.ok && response.status !== 409) {
        throw new Error(data.error ?? "Failed to start analysis");
      }

      if (data.analysisRun) {
        setLiveAnalysisRun(serializeAnalysisRun(data.analysisRun));
        setLiveSuggestions([]);
        setLivePendingCount(0);
      }
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Failed to start analysis",
      );
    } finally {
      setRunning(false);
    }
  }

  async function clearAnalysis() {
    if (
      !window.confirm(
        "Clear all AI suggestions and analysis history for this project?",
      )
    ) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{ error?: string }>(response);

      if (!data && !response.ok) {
        throw new Error("Failed to clear analysis");
      }

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to clear analysis");
      }

      setLiveSuggestions([]);
      setLivePendingCount(0);
      setLiveAnalysisRun(null);
      router.refresh();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Failed to clear analysis",
      );
    } finally {
      setClearing(false);
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
      const data = await readResponseJson<{
        error?: string;
        suggestion?: SuggestionRow;
      }>(response);

      if (!data) {
        throw new Error("Empty response from server");
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update suggestion");
      }

      if (data.suggestion) {
        setLiveSuggestions((current) => {
          if (status === "APPLIED") {
            return current.map((row) =>
              row.id === suggestionId ? data.suggestion! : row,
            );
          }

          return current.filter((row) => row.id !== suggestionId);
        });

        if (status === "DISMISSED") {
          setLivePendingCount((count) => Math.max(0, count - 1));
        }
      }

      if (status === "DISMISSED") {
        router.refresh();
      }
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
            {livePendingCount > 0 ? (
              <Badge variant="secondary">{livePendingCount} pending</Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Local Ollama analysis on synced issues. Apply updates the linked
            issue on GitLab or GitHub (description or duplicate close).
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-2">
          {canAnalyze ? (
            <>
              <Button
                variant="outline"
                onClick={clearAnalysis}
                disabled={clearing || running || analysisInProgress || applyInProgress}
              >
                {clearing ? "Clearing…" : "Clear analysis"}
              </Button>
              <Button
                onClick={runAnalysis}
                disabled={running || clearing || analysisInProgress}
              >
                {running || analysisInProgress ? "Analyzing…" : "Run analysis"}
              </Button>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {liveAnalysisRun ? (
          <p className="text-sm text-muted-foreground">
            Last run: {liveAnalysisRun.status.toLowerCase()}
            {!analysisInProgress && liveAnalysisRun.suggestionsCreated > 0
              ? ` · ${liveAnalysisRun.suggestionsCreated} suggestion(s) created`
              : ""}
            {liveAnalysisRun.errorMessage
              ? ` · ${liveAnalysisRun.errorMessage}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No analysis runs yet. Sync issues first, then run analysis.
          </p>
        )}

        {analysisInProgress ? (
          <AnalysisProgressBar
            completed={liveAnalysisRun?.completedSteps ?? 0}
            total={liveAnalysisRun?.totalSteps ?? 0}
            label={liveAnalysisRun?.progressLabel ?? "Starting analysis…"}
          />
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!analysisInProgress && liveSuggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open suggestions. Run analysis after syncing open issues.
          </p>
        ) : null}

        {!analysisInProgress && liveSuggestions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Suggestion</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveSuggestions.map((suggestion) => {
                const isApplying = suggestion.status === "APPLYING";
                const isFailed = suggestion.status === "APPLY_FAILED";
                const isPending = suggestion.status === "PENDING";
                const isActing = actingId === suggestion.id;

                return (
                <TableRow key={suggestion.id}>
                  <TableCell>
                    <Badge variant="outline">{suggestion.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        isFailed
                          ? "destructive"
                          : isApplying
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {isApplying ? "Applying…" : suggestion.status.toLowerCase()}
                    </Badge>
                    {isFailed && suggestion.writeBackError ? (
                      <p className="mt-1 max-w-xs text-xs text-destructive">
                        {suggestion.writeBackError}
                      </p>
                    ) : null}
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
                  <TableCell>
                    <SuggestionTextCell
                      type={suggestion.type}
                      text={suggestion.suggestedText}
                    />
                  </TableCell>
                  <TableCell>
                    {suggestion.confidence != null
                      ? `${Math.round(suggestion.confidence * 100)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isPending && canDismiss ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isActing || isApplying}
                          onClick={() =>
                            updateSuggestion(suggestion.id, "DISMISSED")
                          }
                        >
                          Dismiss
                        </Button>
                      ) : null}
                      {isPending && canApply ? (
                        <Button
                          size="sm"
                          disabled={isActing || isApplying}
                          onClick={() =>
                            updateSuggestion(suggestion.id, "APPLIED")
                          }
                        >
                          Apply
                        </Button>
                      ) : null}
                      {isFailed && canApply ? (
                        <Button
                          size="sm"
                          disabled={isActing}
                          onClick={() =>
                            updateSuggestion(suggestion.id, "APPLIED")
                          }
                        >
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
