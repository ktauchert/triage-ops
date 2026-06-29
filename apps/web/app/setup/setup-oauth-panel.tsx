"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LEGAL_PATHS } from "@/lib/legal/paths";
import type { AuthProvider } from "@/lib/auth/config";
import { signInFromSetup } from "./actions";

type SetupOAuthPanelProps = {
  providers: AuthProvider[];
  hasStaleSession: boolean;
};

export function SetupOAuthPanel({
  providers,
  hasStaleSession,
}: SetupOAuthPanelProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  return (
    <div className="space-y-4">
      <label className="flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-primary"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          disabled={hasStaleSession}
        />
        <span>
          I agree to the{" "}
          <Link href={LEGAL_PATHS.eula} className="font-medium underline" target="_blank">
            End User License Agreement
          </Link>{" "}
          and{" "}
          <Link
            href={LEGAL_PATHS.privacy}
            className="font-medium underline"
            target="_blank"
          >
            Privacy Policy
          </Link>
          . I confirm this organization meets the current SME eligibility criteria
          described in the EULA.
        </span>
      </label>

      {providers.map((provider) => (
        <form key={provider} action={signInFromSetup}>
          <input
            type="hidden"
            name="termsAccepted"
            value={acceptedTerms ? "true" : "false"}
          />
          <input type="hidden" name="provider" value={provider} />
          <Button
            type="submit"
            className="w-full"
            variant="default"
            disabled={hasStaleSession || !acceptedTerms}
          >
            Continue with {provider === "github" ? "GitHub" : "GitLab"}
          </Button>
        </form>
      ))}
    </div>
  );
}
