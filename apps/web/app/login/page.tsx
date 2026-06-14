import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getConfiguredProviders, isAuthDisabled } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  if (session?.user && !isAuthDisabled()) {
    redirect(callbackUrl ?? "/");
  }

  const providers = getConfiguredProviders();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to TriageOps</CardTitle>
          <CardDescription>
            Authenticate to manage connections and view triage metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAuthDisabled() ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Auth is disabled for development (
              <code className="text-xs">AUTH_DISABLED=true</code>).{" "}
              <Link href="/" className="font-medium underline">
                Continue to dashboard
              </Link>
            </div>
          ) : null}

          {error === "AccessDenied" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Access denied. Your account is not on the allowlist for this
              instance.
            </div>
          ) : null}

          {providers.length === 0 && !isAuthDisabled() ? (
            <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
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
                  redirectTo: callbackUrl ?? "/",
                });
              }}
            >
              <Button type="submit" className="w-full" variant="default">
                Sign in with {provider === "github" ? "GitHub" : "GitLab"}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
