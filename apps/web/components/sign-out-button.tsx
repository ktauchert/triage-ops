import { LogOut } from "lucide-react";
import { signOutTo } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOutTo("/login");
      }}
    >
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </form>
  );
}
