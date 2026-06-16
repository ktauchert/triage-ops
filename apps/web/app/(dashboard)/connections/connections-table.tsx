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
import { cn, formatRelativeDate } from "@/lib/utils";

type ConnectionRow = {
  id: string;
  name: string;
  provider: "GITLAB" | "GITHUB";
  baseUrl: string;
  isFavorite: boolean;
  createdAt: Date | string;
  _count: { projects: number };
};

export function ConnectionsTable({
  connections,
}: {
  connections: ConnectionRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFavorite(connection: ConnectionRow) {
    setBusyId(connection.id);
    setError(null);

    try {
      const response = await fetch(`/api/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !connection.isFavorite }),
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
      setBusyId(null);
    }
  }

  async function handleDelete(connection: ConnectionRow) {
    const projectNote =
      connection._count.projects > 0
        ? ` This will also delete ${connection._count.projects} registered project(s).`
        : "";

    if (
      !window.confirm(
        `Delete connection "${connection.name}"?${projectNote} This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusyId(connection.id);
    setError(null);

    try {
      const response = await fetch(`/api/connections/${connection.id}`, {
        method: "DELETE",
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete connection");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete connection",
      );
    } finally {
      setBusyId(null);
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
          <CardTitle>Registered connections</CardTitle>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No connections yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 px-0"
                        disabled={busyId === connection.id}
                        onClick={() => handleFavorite(connection)}
                        aria-label={
                          connection.isFavorite
                            ? "Remove favorite"
                            : "Mark as favorite"
                        }
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            connection.isFavorite
                              ? "fill-amber-400 text-amber-500"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                    </TableCell>
                    <TableCell>{connection.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{connection.provider}</Badge>
                    </TableCell>
                    <TableCell>{connection.baseUrl}</TableCell>
                    <TableCell>{connection._count.projects}</TableCell>
                    <TableCell>
                      {formatRelativeDate(connection.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyId === connection.id}
                        onClick={() => handleDelete(connection)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
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
