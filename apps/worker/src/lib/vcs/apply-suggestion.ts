import { IssueSuggestionType, VcsProvider } from "@triage-ops/db";
import {
  addGitHubIssueComment,
  closeGitHubIssueAsDuplicate,
  updateGitHubIssueBody,
} from "../github/write.js";
import { parseGitHubRepo } from "../github/normalize.js";
import {
  addGitLabIssueNote,
  closeGitLabIssue,
  updateGitLabIssueDescription,
} from "../gitlab/write.js";
import {
  duplicateCanonicalComment,
  duplicateCloseComment,
  pickDuplicateSides,
} from "./duplicate-sides.js";

export type ApplySuggestionContext = {
  provider: VcsProvider;
  baseUrl: string;
  accessToken: string;
  externalProjectId: number | null;
  pathWithNamespace: string;
  type: IssueSuggestionType;
  suggestedText: string | null;
  issueIid: number;
  relatedIssueIid: number | null;
};

export type ApplySuggestionResult = {
  updatedIssueIds: string[];
  localUpdates: Array<{
    issueId: string;
    description?: string;
    state?: "OPEN" | "CLOSED";
  }>;
};

export type IssueRef = {
  id: string;
  gitlabIssueIid: number;
};

export async function applySuggestionToVcs(
  context: ApplySuggestionContext,
  issues: { primary: IssueRef; related: IssueRef | null },
): Promise<ApplySuggestionResult> {
  if (context.provider === VcsProvider.GITHUB) {
    return applyGitHubSuggestion(context, issues);
  }

  return applyGitLabSuggestion(context, issues);
}

async function applyGitLabSuggestion(
  context: ApplySuggestionContext,
  issues: { primary: IssueRef; related: IssueRef | null },
): Promise<ApplySuggestionResult> {
  if (
    context.externalProjectId === null ||
    !Number.isInteger(context.externalProjectId) ||
    context.externalProjectId <= 0
  ) {
    throw new Error("GitLab projects require a positive externalProjectId");
  }

  const base = {
    baseUrl: context.baseUrl,
    accessToken: context.accessToken,
    gitlabProjectId: context.externalProjectId,
  };

  if (context.type === IssueSuggestionType.DESCRIPTION) {
    if (!context.suggestedText?.trim()) {
      throw new Error("Description suggestion is missing suggested text");
    }

    await updateGitLabIssueDescription({
      ...base,
      issueIid: context.issueIid,
      description: context.suggestedText,
    });

    return {
      updatedIssueIds: [issues.primary.id],
      localUpdates: [
        {
          issueId: issues.primary.id,
          description: context.suggestedText,
        },
      ],
    };
  }

  if (!issues.related || context.relatedIssueIid === null) {
    throw new Error("Duplicate suggestion is missing related issue");
  }

  const { canonicalIid, duplicateIid } = pickDuplicateSides({
    issueIid: context.issueIid,
    relatedIssueIid: context.relatedIssueIid,
  });

  const canonicalIssue =
    issues.primary.gitlabIssueIid === canonicalIid
      ? issues.primary
      : issues.related;
  const duplicateIssue =
    issues.primary.gitlabIssueIid === duplicateIid
      ? issues.primary
      : issues.related;

  await addGitLabIssueNote({
    ...base,
    issueIid: duplicateIid,
    body: duplicateCloseComment(canonicalIid),
  });
  await addGitLabIssueNote({
    ...base,
    issueIid: canonicalIid,
    body: duplicateCanonicalComment(duplicateIid),
  });
  await closeGitLabIssue({
    ...base,
    issueIid: duplicateIid,
  });

  return {
    updatedIssueIds: [canonicalIssue.id, duplicateIssue.id],
    localUpdates: [
      {
        issueId: duplicateIssue.id,
        state: "CLOSED",
      },
    ],
  };
}

async function applyGitHubSuggestion(
  context: ApplySuggestionContext,
  issues: { primary: IssueRef; related: IssueRef | null },
): Promise<ApplySuggestionResult> {
  const { owner, repo } = parseGitHubRepo(context.pathWithNamespace);
  const base = {
    accessToken: context.accessToken,
    owner,
    repo,
    baseUrl: context.baseUrl,
  };

  if (context.type === IssueSuggestionType.DESCRIPTION) {
    if (!context.suggestedText?.trim()) {
      throw new Error("Description suggestion is missing suggested text");
    }

    await updateGitHubIssueBody({
      ...base,
      issueNumber: context.issueIid,
      body: context.suggestedText,
    });

    return {
      updatedIssueIds: [issues.primary.id],
      localUpdates: [
        {
          issueId: issues.primary.id,
          description: context.suggestedText,
        },
      ],
    };
  }

  if (!issues.related || context.relatedIssueIid === null) {
    throw new Error("Duplicate suggestion is missing related issue");
  }

  const { canonicalIid, duplicateIid } = pickDuplicateSides({
    issueIid: context.issueIid,
    relatedIssueIid: context.relatedIssueIid,
  });

  const duplicateIssue =
    issues.primary.gitlabIssueIid === duplicateIid
      ? issues.primary
      : issues.related;
  const canonicalIssue =
    issues.primary.gitlabIssueIid === canonicalIid
      ? issues.primary
      : issues.related;

  await addGitHubIssueComment({
    ...base,
    issueNumber: duplicateIid,
    body: duplicateCloseComment(canonicalIid),
  });
  await addGitHubIssueComment({
    ...base,
    issueNumber: canonicalIid,
    body: duplicateCanonicalComment(duplicateIid),
  });
  await closeGitHubIssueAsDuplicate({
    ...base,
    issueNumber: duplicateIid,
  });

  return {
    updatedIssueIds: [canonicalIssue.id, duplicateIssue.id],
    localUpdates: [
      {
        issueId: duplicateIssue.id,
        state: "CLOSED",
      },
    ],
  };
}
