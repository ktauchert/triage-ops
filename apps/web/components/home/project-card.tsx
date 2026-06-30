import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjectHealthStrip } from "@/components/project/project-health-strip";
import { projectDashboardPath } from "@/lib/navigation";
import { formatRelativeDate } from "@/lib/utils";
import type { HomeProjectCard } from "@/lib/services/home";

export function HomeProjectCard({ project }: { project: HomeProjectCard }) {
  return (
    <Link href={projectDashboardPath(project.id)} className="block group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
          </div>
          <CardDescription className="font-mono text-xs">
            {project.pathWithNamespace}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProjectHealthStrip signals={project.healthSignals} />
          <p className="text-xs text-muted-foreground">
            Last synced {formatRelativeDate(project.lastSyncedAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{project.openIssues} open</Badge>
            {project.staleCount > 0 ? (
              <Badge variant="outline">{project.staleCount} stale</Badge>
            ) : null}
            {project.stuckCount > 0 ? (
              <Badge variant="outline">{project.stuckCount} stuck</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
