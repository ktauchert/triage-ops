import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRecentBackgroundJobs } from "@/lib/services/admin";
import { AdminJobsTable } from "./admin-jobs-table";

export const dynamic = "force-dynamic";

type AdminJobsPageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminJobsPage({ searchParams }: AdminJobsPageProps) {
  const { filter } = await searchParams;
  const initialFilter =
    filter === "failed" || filter === "running" ? filter : "all";
  const jobs = await listRecentBackgroundJobs(30);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Background jobs" },
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-heading">Background jobs</h2>
          <p className="page-subheading">
            Recent sync, LLM analysis, and write-back activity across all projects.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">Back to overview</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>
            Last 30 jobs merged from sync runs, analysis runs, and write-back attempts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminJobsTable jobs={jobs} initialFilter={initialFilter} />
        </CardContent>
      </Card>
    </div>
  );
}
