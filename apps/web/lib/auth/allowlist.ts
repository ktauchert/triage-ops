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

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
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
