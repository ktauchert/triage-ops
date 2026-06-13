export function daysSince(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

export function isInactiveSince(
  lastActivityAt: Date | null,
  thresholdDays: number,
  now: Date,
): boolean {
  if (lastActivityAt === null) {
    return true;
  }

  return daysSince(lastActivityAt, now) > thresholdDays;
}
