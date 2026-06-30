import { IssueSuggestionType, VcsProvider } from "@gridnull/db";
import {
  addGitHubIssueComment,
  closeGitHubIssueAsDuplicate,
  getGitHubIssueState,
  listGitHubIssueCommentBodies,
  updateGitHubIssueBody,
} from "../github/write.js";
import { parseGitHubRepo } from "../github/normalize.js";
import {
  addGitLabIssueNote,
  closeGitLabIssue,
  getGitLabIssueState,
  listGitLabIssueNoteBodies,
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

  // Idempotent: a retry after a partial failure must not duplicate notes or
  // re-close. Check existing notes/state before each mutation.
  const duplicateCloseBody = duplicateCloseComment(canonicalIid);
  const canonicalBody = duplicateCanonicalComment(duplicateIid);

  const duplicateNotes = await listGitLabIssueNoteBodies({
    ...base,
    issueIid: duplicateIid,
  });
  if (!duplicateNotes.includes(duplicateCloseBody)) {
    await addGitLabIssueNote({
      ...base,
      issueIid: duplicateIid,
      body: duplicateCloseBody,
    });
  }

  const canonicalNotes = await listGitLabIssueNoteBodies({
    ...base,
    issueIid: canonicalIid,
  });
  if (!canonicalNotes.includes(canonicalBody)) {
    await addGitLabIssueNote({
      ...base,
      issueIid: canonicalIid,
      body: canonicalBody,
    });
  }

  const duplicateState = await getGitLabIssueState({
    ...base,
    issueIid: duplicateIid,
  });
  if (duplicateState !== "closed") {
    await closeGitLabIssue({
      ...base,
      issueIid: duplicateIid,
    });
  }

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

  // Idempotent: a retry after a partial failure must not duplicate comments or
  // re-close. Check existing comments/state before each mutation.
  const duplicateCloseBody = duplicateCloseComment(canonicalIid);
  const canonicalBody = duplicateCanonicalComment(duplicateIid);

  const duplicateComments = await listGitHubIssueCommentBodies({
    ...base,
    issueNumber: duplicateIid,
  });
  if (!duplicateComments.includes(duplicateCloseBody)) {
    await addGitHubIssueComment({
      ...base,
      issueNumber: duplicateIid,
      body: duplicateCloseBody,
    });
  }

  const canonicalComments = await listGitHubIssueCommentBodies({
    ...base,
    issueNumber: canonicalIid,
  });
  if (!canonicalComments.includes(canonicalBody)) {
    await addGitHubIssueComment({
      ...base,
      issueNumber: canonicalIid,
      body: canonicalBody,
    });
  }

  const duplicateState = await getGitHubIssueState({
    ...base,
    issueNumber: duplicateIid,
  });
  if (duplicateState !== "closed") {
    await closeGitHubIssueAsDuplicate({
      ...base,
      issueNumber: duplicateIid,
    });
  }

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
