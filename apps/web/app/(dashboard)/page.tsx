import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HomeProjectCard } from "@/components/home/project-card";
import { RoleCapabilityChips } from "@/components/home/role-capability-chips";
import { getRoleCapabilities, getRoleCapabilityLabels } from "@/lib/auth/permissions";
import { getAuthContext } from "@/lib/auth/session";
import { legacyProjectRedirectPath } from "@/lib/navigation";
import { formatUserRole, getHomeSummary } from "@/lib/services/home";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ project?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { project: legacyProjectParam } = await searchParams;
  const legacyRedirect = legacyProjectRedirectPath(legacyProjectParam);

  if (legacyRedirect) {
    redirect(legacyRedirect);
  }

  const authContext = await getAuthContext();
  const summary = await getHomeSummary(authContext);
  const capabilities = getRoleCapabilities(summary.user.role);
  const capabilityLabels = getRoleCapabilityLabels(summary.user.role);
  const displayName =
    summary.user.name ?? summary.user.email ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="page-heading">Welcome, {displayName}</h2>
        <p className="page-subheading">
          {summary.dataScope === "shared"
            ? "Your triage overview across this instance."
            : "Your triage overview and starred projects."}
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatUserRole(summary.user.role)}</Badge>
            {summary.user.email && summary.user.name ? (
              <span className="text-sm text-muted-foreground">
                {summary.user.email}
              </span>
            ) : null}
          </div>
          <RoleCapabilityChips labels={capabilityLabels} />
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="section-heading">Starred projects</h3>
            <p className="text-sm text-muted-foreground">
              Open a project to view triage metrics and AI suggestions.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/projects">
              All projects ({summary.totalProjects})
            </Link>
          </Button>
        </div>

        {summary.favoriteProjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.favoriteProjects.map((project) => (
              <HomeProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : summary.totalProjects > 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <p>No starred projects yet.</p>
            <p className="mt-2">
              Star projects on the{" "}
              <Link href="/projects" className="font-medium text-primary hover:underline">
                projects page
              </Link>{" "}
              to pin them here, then open one to start triaging.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <p>No projects registered yet.</p>
            <p className="mt-2">
              {capabilities.canManageConnections ? (
                <>
                  Add a{" "}
                  <Link
                    href="/connections"
                    className="font-medium text-primary hover:underline"
                  >
                    connection
                  </Link>{" "}
                  and register a project to get started.
                </>
              ) : (
                <>
                  Ask your admin to register a project, or open the{" "}
                  <Link
                    href="/projects"
                    className="font-medium text-primary hover:underline"
                  >
                    projects page
                  </Link>{" "}
                  when one becomes available.
                </>
              )}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
