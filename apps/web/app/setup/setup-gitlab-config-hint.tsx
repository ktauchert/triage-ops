import { authConfig } from "@/lib/auth/config";

export function SetupGitLabConfigHint() {
  const callbackUrl = `${authConfig.url}/api/auth/callback/gitlab`;

  return (
    <details className="glass-subtle group rounded-lg border text-sm text-muted-foreground">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Configure GitLab sign-in
          <span
            aria-hidden
            className="text-xs text-muted-foreground transition-transform group-open:rotate-180"
          >
            ▼
          </span>
        </span>
      </summary>
      <div className="space-y-3 border-t px-4 py-3 leading-relaxed">
        <p>
          GitLab login is configured in your environment, not in this UI. An
          instance operator must register an OAuth application and set these
          variables before the GitLab button appears.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            In GitLab, open <strong>Admin → Applications</strong> (self-hosted)
            or <strong>User Settings → Applications</strong> (gitlab.com).
          </li>
          <li>
            Set the redirect URI to{" "}
            <code className="break-all text-xs">{callbackUrl}</code>
          </li>
          <li>
            Enable scopes <code className="text-xs">read_user</code> (or{" "}
            <code className="text-xs">openid</code>,{" "}
            <code className="text-xs">profile</code>,{" "}
            <code className="text-xs">email</code> on some instances).
          </li>
          <li>
            Add to <code className="text-xs">.env</code> and restart the web
            service:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <code className="text-xs">AUTH_GITLAB_ID</code>
              </li>
              <li>
                <code className="text-xs">AUTH_GITLAB_SECRET</code>
              </li>
              <li>
                <code className="text-xs">AUTH_GITLAB_ISSUER</code> — e.g.{" "}
                <code className="text-xs">https://gitlab.com</code> or your
                self-hosted GitLab URL
              </li>
            </ul>
          </li>
          <li>
            Ensure <code className="text-xs">AUTH_PROVIDERS</code> includes{" "}
            <code className="text-xs">gitlab</code> (default:{" "}
            <code className="text-xs">github,gitlab</code>).
          </li>
        </ol>
        <p>
          Login OAuth is separate from issue sync. After setup, users add a PAT
          on <strong>Connections</strong> to sync GitLab projects.
        </p>
      </div>
    </details>
  );
}
