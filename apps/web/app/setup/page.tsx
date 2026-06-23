import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { signOutTo } from "@/lib/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConfiguredProviders, isAuthDisabled } from "@/lib/auth/config";
import { isDevAuthBypassAllowed } from "@/lib/auth/environment";
import { isSetupComplete } from "@/lib/auth/setup";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SetupPage({ searchParams }: SetupPageProps) {
  if (isAuthDisabled()) {
    if (isDevAuthBypassAllowed()) {
      redirect("/");
    }
  }

  if (await isSetupComplete()) {
    const session = await auth();
    redirect(session?.user ? "/" : "/login");
  }

  const session = await auth();
  const { error } = await searchParams;
  const providers = getConfiguredProviders();
  const hasStaleSession = Boolean(session?.user);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute top-6 right-6">
        <ThemeToggle showLabel={false} />
      </div>
      <Card className="w-full max-w-md shadow-2xl shadow-primary/10">
        <CardHeader className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
            TriageOps
          </p>
          <CardTitle className="text-2xl">Initial setup</CardTitle>
          <CardDescription>
            Sign in with GitHub or GitLab to create the first administrator
            account for this instance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="glass-subtle rounded-lg border px-4 py-3 text-sm text-muted-foreground">
            After setup, sign-in is closed. You will invite additional users from{" "}
            <strong>Admin → Users</strong>.
          </div>

          {hasStaleSession ? (
            <div className="glass-subtle space-y-3 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <p>
                An old sign-in session is still active (common after resetting the
                database). Clear it before creating the first admin.
              </p>
              <form
                action={async () => {
                  "use server";
                  await signOutTo("/setup");
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  Clear session
                </Button>
              </form>
            </div>
          ) : null}

          {error === "AccessDenied" ? (
            <div className="glass-subtle rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Access denied. Setup may already be complete, or this account cannot
              become the first admin.
            </div>
          ) : null}

          {providers.length === 0 ? (
            <div className="glass-subtle rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              No OAuth providers are configured. Set{" "}
              <code className="text-xs">AUTH_GITHUB_*</code> or{" "}
              <code className="text-xs">AUTH_GITLAB_*</code> in your environment.
            </div>
          ) : null}

          {providers.map((provider) => (
            <form
              key={provider}
              action={async () => {
                "use server";
                await signIn(provider, {
                  redirectTo: "/",
                });
              }}
            >
              <Button
                type="submit"
                className="w-full"
                variant="default"
                disabled={hasStaleSession}
              >
                Continue with {provider === "github" ? "GitHub" : "GitLab"}
              </Button>
            </form>
          ))}

          {hasStaleSession ? (
            <p className="text-center text-xs text-muted-foreground">
              Or use a private/incognito window after clearing site data for{" "}
              <code className="text-xs">localhost</code>.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
