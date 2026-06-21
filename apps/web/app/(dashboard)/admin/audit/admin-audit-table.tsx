"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeDate } from "@/lib/utils";
import { readResponseJson } from "@/lib/fetch-json";

type AuditEventRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { email: string | null; name: string | null } | null;
};

export function AdminAuditTable({
  initialEvents,
}: {
  initialEvents: AuditEventRow[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (action.trim()) {
        params.set("action", action.trim());
      }
      params.set("limit", "200");

      const response = await fetch(
        `/api/admin/audit-events?${params.toString()}`,
      );
      const data = await readResponseJson<{ error?: string; events?: AuditEventRow[] }>(
        response,
      );

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to load audit events");
      }

      setEvents(data?.events ?? []);
    } catch (filterError) {
      setError(
        filterError instanceof Error
          ? filterError.message
          : "Failed to load audit events",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => void handleFilter(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                placeholder="e.g. suggestion.apply"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading…" : "Apply filter"}
            </Button>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatRelativeDate(event.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.user?.name ?? event.user?.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.resourceType}
                      {event.resourceId ? (
                        <span className="block text-xs text-muted-foreground">
                          {event.resourceId}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {event.metadata
                        ? JSON.stringify(event.metadata)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
