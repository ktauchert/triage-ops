export type AuthProvider = "github" | "gitlab";
export type AuthDataScope = "shared" | "per_user";

export const DEV_USER_ID = "dev-local";

function parseList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseProviders(value: string | undefined): AuthProvider[] {
  const providers = parseList(value).filter(
    (entry): entry is AuthProvider => entry === "github" || entry === "gitlab",
  );

  return providers.length > 0 ? providers : ["github", "gitlab"];
}

function parseDataScope(value: string | undefined): AuthDataScope {
  return value === "per_user" ? "per_user" : "shared";
}

export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}

export function getDataScope(): AuthDataScope {
  return parseDataScope(process.env.AUTH_DATA_SCOPE);
}

export function getAuthProviders(): AuthProvider[] {
  return parseProviders(process.env.AUTH_PROVIDERS);
}

export const authConfig = {
  get disabled() {
    return isAuthDisabled();
  },
  secret: process.env.AUTH_SECRET,
  url: process.env.AUTH_URL ?? "http://localhost:3000",
  get providers() {
    return getAuthProviders();
  },
  get dataScope() {
    return getDataScope();
  },
  github: {
    clientId: process.env.AUTH_GITHUB_ID,
    clientSecret: process.env.AUTH_GITHUB_SECRET,
  },
  gitlab: {
    clientId: process.env.AUTH_GITLAB_ID,
    clientSecret: process.env.AUTH_GITLAB_SECRET,
    issuer: process.env.AUTH_GITLAB_ISSUER ?? "https://gitlab.com",
  },
};

export function isProviderConfigured(provider: AuthProvider): boolean {
  if (provider === "github") {
    return Boolean(authConfig.github.clientId && authConfig.github.clientSecret);
  }

  return Boolean(authConfig.gitlab.clientId && authConfig.gitlab.clientSecret);
}

export function getConfiguredProviders(): AuthProvider[] {
  return authConfig.providers.filter(isProviderConfigured);
}

export function getAdminEmails(): string[] {
  return parseList(process.env.ADMIN_EMAILS).map((entry) =>
    entry.toLowerCase(),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}
