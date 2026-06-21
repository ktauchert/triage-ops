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
  ghostThresholdDays: number;
  zombieThresholdDays: number;
  canEdit: boolean;
};

export function ThresholdSettings({
  projectId,
  ghostThresholdDays,
  zombieThresholdDays,
  canEdit,
}: ThresholdSettingsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ghostThresholdDays: String(ghostThresholdDays),
    zombieThresholdDays: String(zombieThresholdDays),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const ghostDays = Number.parseInt(form.ghostThresholdDays, 10);
    const zombieDays = Number.parseInt(form.zombieThresholdDays, 10);

    if (
      Number.isNaN(ghostDays) ||
      Number.isNaN(zombieDays) ||
      ghostDays < 0 ||
      zombieDays < 0
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
          ghostThresholdDays: ghostDays,
          zombieThresholdDays: zombieDays,
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
          Per-project inactivity windows for ghost and zombie triage signals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? (
        <form onSubmit={handleSubmit} className="grid max-w-xl gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ghost-threshold">Ghost days</Label>
            <Input
              id="ghost-threshold"
              type="number"
              min={0}
              value={form.ghostThresholdDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ghostThresholdDays: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zombie-threshold">Zombie days</Label>
            <Input
              id="zombie-threshold"
              type="number"
              min={0}
              value={form.zombieThresholdDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  zombieThresholdDays: event.target.value,
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
            Ghost: {ghostThresholdDays} days · Zombie: {zombieThresholdDays} days
            (read-only for your role)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
