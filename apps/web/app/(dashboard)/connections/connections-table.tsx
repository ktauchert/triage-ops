import { Badge } from "@/components/ui/badge";
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
import { formatRelativeDate } from "@/lib/utils";

type ConnectionRow = {
  id: string;
  name: string;
  provider: "GITLAB" | "GITHUB";
  baseUrl: string;
  createdAt: Date;
  _count: { projects: number };
};

export function ConnectionsTable({
  connections,
}: {
  connections: ConnectionRow[];
}) {
  return (
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
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell>{connection.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{connection.provider}</Badge>
                  </TableCell>
                  <TableCell>{connection.baseUrl}</TableCell>
                  <TableCell>{connection._count.projects}</TableCell>
                  <TableCell>
                    {formatRelativeDate(connection.createdAt)}
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
