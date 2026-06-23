function parseList(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function getAllowlist() {
  return {
    domains: parseList(process.env.ALLOWED_EMAIL_DOMAINS),
    emails: parseList(process.env.ALLOWED_EMAILS),
  };
}

export function normalizeEmail(
  email: string | null | undefined,
): string | null {
  if (!email?.trim()) {
    return null;
  }

  return email.trim().toLowerCase();
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const { domains, emails } = getAllowlist();

  if (domains.length === 0 && emails.length === 0) {
    return true;
  }

  if (emails.includes(normalizedEmail)) {
    return true;
  }

  const atIndex = normalizedEmail.lastIndexOf("@");
  if (atIndex === -1) {
    return false;
  }

  const domain = normalizedEmail.slice(atIndex + 1);
  return domains.includes(domain);
}
