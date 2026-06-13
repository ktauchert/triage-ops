import { getProjectMetrics } from "@/lib/services/metrics";
import { listProjects } from "@/lib/services/projects";
import { DashboardMetrics } from "./dashboard-metrics";
import { ProjectSelector } from "./project-selector";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const projects = await listProjects();
  const { project: projectParam } = await searchParams;
  const selectedProjectId =
    projectParam && projects.some((project) => project.id === projectParam)
      ? projectParam
      : (projects[0]?.id ?? null);

  const metrics = selectedProjectId
    ? await getProjectMetrics(selectedProjectId)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Triage metrics from your last issue sync.
        </p>
      </div>

      <ProjectSelector
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          pathWithNamespace: project.pathWithNamespace,
        }))}
        selectedProjectId={selectedProjectId}
      />

      <DashboardMetrics metrics={metrics} />
    </div>
  );
}
