"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ThresholdSettingsProps = {
  projectId: string;
  staleThresholdDays: number;
  stuckThresholdDays: number;
  canEdit: boolean;
};

export function ThresholdSettings({
  projectId,
  staleThresholdDays,
  stuckThresholdDays,
  canEdit,
}: ThresholdSettingsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    staleThresholdDays: String(staleThresholdDays),
    stuckThresholdDays: String(stuckThresholdDays),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const staleDays = Number.parseInt(form.staleThresholdDays, 10);
    const stuckDays = Number.parseInt(form.stuckThresholdDays, 10);

    if (
      Number.isNaN(staleDays) ||
      Number.isNaN(stuckDays) ||
      staleDays < 0 ||
      stuckDays < 0
    ) {
      setError("Thresholds must be non-negative integers.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staleThresholdDays: staleDays,
          stuckThresholdDays: stuckDays,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save thresholds");
      }

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save thresholds",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric thresholds</CardTitle>
        <CardDescription>
          Per-project inactivity windows for stale and stuck triage signals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? (
        <form onSubmit={handleSubmit} className="grid max-w-xl gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="stale-threshold">Stale days</Label>
            <Input
              id="stale-threshold"
              type="number"
              min={0}
              value={form.staleThresholdDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  staleThresholdDays: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stuck-threshold">Stuck days</Label>
            <Input
              id="stuck-threshold"
              type="number"
              min={0}
              value={form.stuckThresholdDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  stuckThresholdDays: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-3">{error}</p>
          ) : null}
        </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Stale: {staleThresholdDays} days · Stuck: {stuckThresholdDays} days
            (read-only for your role)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
