export type IssueForDescriptionDraft = {
  id: string;
  gitlabIssueIid: number;
  title: string;
  description: string | null;
  labels: string[];
};

export function hasEmptyDescription(description: string | null | undefined): boolean {
  return !description || description.trim().length === 0;
}

export function filterIssuesNeedingDescription(
  issues: IssueForDescriptionDraft[],
): IssueForDescriptionDraft[] {
  return issues.filter((issue) => hasEmptyDescription(issue.description));
}

export function buildDescriptionDraftPrompt(issue: IssueForDescriptionDraft): string {
  const labels =
    issue.labels.length > 0 ? issue.labels.join(", ") : "none";

  return [
    "You are helping triage a software project issue tracker.",
    "Write a concise issue description in markdown.",
    "Include: problem summary, expected behavior, and suggested acceptance criteria.",
    "Do not invent specific URLs or ticket numbers.",
    "Respond with only the description body, no preamble.",
    "",
    `Title: ${issue.title}`,
    `Labels: ${labels}`,
  ].join("\n");
}

export function parseDescriptionDraft(raw: string): string {
  return raw.trim();
}

export type ChatFn = (prompt: string) => Promise<string>;

export type DraftProgress = (
  completedDrafts: number,
  totalDrafts: number,
) => void | Promise<void>;

export async function draftDescriptions(
  issues: IssueForDescriptionDraft[],
  chatFn: ChatFn,
  options?: { onDraftComplete?: DraftProgress },
): Promise<Array<{ issueId: string; suggestedText: string }>> {
  const targets = filterIssuesNeedingDescription(issues);
  const drafts: Array<{ issueId: string; suggestedText: string }> = [];

  for (let index = 0; index < targets.length; index += 1) {
    const issue = targets[index];
    if (!issue) {
      continue;
    }

    const prompt = buildDescriptionDraftPrompt(issue);
    const raw = await chatFn(prompt);
    const suggestedText = parseDescriptionDraft(raw);
    if (suggestedText) {
      drafts.push({ issueId: issue.id, suggestedText });
    }

    await options?.onDraftComplete?.(index + 1, targets.length);
  }

  return drafts;
}
