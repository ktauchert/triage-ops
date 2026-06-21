import { AppSidebarNav, SidebarUser } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { getAuthContext, getSessionUser } from "@/lib/auth/session";
import { isAuthDisabled } from "@/lib/auth/config";
import { UserRole } from "@triage-ops/db";

export async function AppSidebar() {
  const [user, authContext] = await Promise.all([
    getSessionUser(),
    getAuthContext(),
  ]);
  const showAdminLink = authContext.role === UserRole.ADMIN;

  return (
    <aside className="glass flex h-full w-64 shrink-0 flex-col border-r shadow-xl shadow-black/[0.03] dark:shadow-black/30">
      <AppSidebarNav showAdminLink={showAdminLink} />
      <div className="mt-auto">
        <Separator />
        <div className="space-y-3 p-4">
          <ThemeToggle />
          {!isAuthDisabled() && user ? (
            <>
              <SidebarUser email={user.email} name={user.name} />
              <SignOutButton />
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
