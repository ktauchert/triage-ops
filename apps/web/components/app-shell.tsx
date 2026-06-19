import { AppSidebarNav, SidebarUser } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { getSessionUser } from "@/lib/auth/session";
import { isAuthDisabled } from "@/lib/auth/config";

export async function AppSidebar() {
  const user = await getSessionUser();

  return (
    <aside className="glass flex h-full w-64 shrink-0 flex-col border-r shadow-xl shadow-black/[0.03] dark:shadow-black/30">
      <AppSidebarNav />
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
