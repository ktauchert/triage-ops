import Link from "next/link";
import { UserRole } from "@triage-ops/db";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
import { formatUserRole } from "@/lib/services/home";
import type { AdminAuthStatus, AdminBackgroundJob, AdminJobFailure } from "@/lib/services/admin";
import { getAdminOverview } from "@/lib/services/admin";
import { formatRelativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function jobKindLabel(kind: AdminJobFailure["kind"] | AdminBackgroundJob["kind"]): string {
  switch (kind) {
    case "sync":
      return "Sync";
    case "analysis":
      return "Analysis";
    case "writeback":
      return "Write-back";
  }
}

function registrationLabel(mode: AdminAuthStatus["registrationMode"]): string {
  switch (mode) {
    case "closed":
      return "Closed (invite only)";
    case "bootstrap":
      return "Bootstrap (first admin pending)";
    case "open":
      return "Open (auth disabled)";
  }
}

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Admin" },
        ]}
      />

      <div>
        <h2 className="page-heading">Admin overview</h2>
        <p className="page-subheading">
          Instance health, users, background jobs, and VCS connections.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registered users</CardDescription>
            <CardTitle className="text-3xl">{overview.totalUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">Manage users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending invites</CardDescription>
            <CardTitle className="text-3xl">
              {overview.pendingInviteCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/users">Invite users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>VCS connections</CardDescription>
            <CardTitle className="text-3xl">
              {overview.connections.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/connections">Manage connections</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Recent job failures</CardDescription>
            <CardTitle className="text-3xl">
              {overview.recentJobFailures.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/jobs?filter=failed">View background jobs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h3 className="section-heading">Auth & instance</h3>
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Auth mode
              </p>
              <p className="mt-1 text-sm">
                {overview.auth.authDisabled ? "Disabled (dev bypass)" : "OAuth enabled"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Setup
              </p>
              <p className="mt-1 text-sm">
                {overview.auth.setupComplete ? "Complete" : "Incomplete"}
                {overview.auth.setupCompletedAt
                  ? ` · ${formatRelativeDate(overview.auth.setupCompletedAt)}`
                  : null}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Registration
              </p>
              <p className="mt-1 text-sm">
                {registrationLabel(overview.auth.registrationMode)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                OAuth providers
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {overview.auth.configuredProviders.length > 0 ? (
                  overview.auth.configuredProviders.map((provider) => (
                    <Badge key={provider} variant="secondary">
                      {provider}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None configured</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data scope
              </p>
              <p className="mt-1 text-sm">{overview.auth.dataScope}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sessions & access
              </p>
              <p className="mt-1 text-sm">
                {overview.auth.activeSessionCount} active session
                {overview.auth.activeSessionCount === 1 ? "" : "s"}
                {overview.auth.deactivatedUserCount > 0
                  ? ` · ${overview.auth.deactivatedUserCount} deactivated`
                  : null}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Allowlist
              </p>
              <p className="mt-1 text-sm">
                {overview.auth.allowlistConfigured
                  ? `${overview.auth.allowlistDomainCount} domain${overview.auth.allowlistDomainCount === 1 ? "" : "s"}, ${overview.auth.allowlistEmailCount} explicit email${overview.auth.allowlistEmailCount === 1 ? "" : "s"}`
                  : "Not configured"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ADMIN_EMAILS fallback
              </p>
              <p className="mt-1 text-sm">
                {overview.auth.adminEmailsFallbackCount} entr
                {overview.auth.adminEmailsFallbackCount === 1 ? "y" : "ies"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="section-heading">Recent background jobs</h3>
          <Link
            href="/admin/jobs"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all jobs
          </Link>
        </div>
        {overview.recentBackgroundJobs.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentBackgroundJobs.map((job) => (
                    <TableRow key={`${job.kind}-${job.id}`}>
                      <TableCell>
                        <Badge variant="outline">{jobKindLabel(job.kind)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/project/${job.projectId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {job.projectName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{job.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                        {job.errorMessage ?? job.detail ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeDate(job.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No recent background jobs.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="section-heading">Recent job failures</h3>
          <Link
            href="/admin/jobs?filter=failed"
            className="text-sm font-medium text-primary hover:underline"
          >
            View failures
          </Link>
        </div>
        {overview.recentJobFailures.length > 0 ? (
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentJobFailures.map((failure) => (
                    <TableRow key={`${failure.kind}-${failure.id}`}>
                      <TableCell>
                        <Badge variant="outline">{jobKindLabel(failure.kind)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/project/${failure.projectId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {failure.projectName}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                        {failure.errorMessage ?? "Unknown error"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeDate(failure.occurredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recent sync, analysis, or write-back failures.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="section-heading">VCS connections</h3>
          <Link
            href="/connections"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage connections
          </Link>
        </div>
        {overview.connections.length > 0 ? (
          <Card>
            <CardHeader className="pb-0">
              <CardDescription>
                Connection metadata only — access tokens are never shown in the UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Base URL</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.connections.map((connection) => (
                    <TableRow key={connection.id}>
                      <TableCell className="font-medium">
                        {connection.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{connection.provider}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {connection.baseUrl}
                      </TableCell>
                      <TableCell>{connection.projectCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {connection.ownerEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatRelativeDate(connection.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No connections registered.</p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="section-heading">Users by role</h3>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(UserRole) as UserRole[]).map((role) => (
            <Badge key={role} variant="secondary">
              {formatUserRole(role)}: {overview.usersByRole[role]}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="section-heading">Recent audit events</h3>
          <Link
            href="/admin/audit"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>

        {overview.recentAuditEvents.length > 0 ? (
          <Card>
            <CardContent className="divide-y pt-6">
              {overview.recentAuditEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium">{event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.userEmail ?? "System"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        )}
      </section>
    </div>
  );
}
