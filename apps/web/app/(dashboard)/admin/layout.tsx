import { UserRole } from "@triage-ops/db";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();

  if (ctx.role !== UserRole.ADMIN) {
    redirect("/");
  }

  return <>{children}</>;
}
