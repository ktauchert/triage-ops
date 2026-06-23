export function projectDashboardPath(projectId: string): string {
  return `/project/${projectId}`;
}

export function legacyProjectRedirectPath(
  projectId: string | undefined | null,
): string | null {
  const trimmed = projectId?.trim();
  if (!trimmed) {
    return null;
  }

  return projectDashboardPath(trimmed);
}
