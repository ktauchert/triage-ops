import { prisma } from "@gridnull/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncIssueLabels } from "./sync-labels.js";

vi.mock("@gridnull/db", () => ({
  prisma: {
    label: {
      upsert: vi.fn(),
    },
    issueLabel: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe("syncIssueLabels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts labels and replaces issue label links", async () => {
    vi.mocked(prisma.label.upsert)
      .mockResolvedValueOnce({ id: "label-bug", name: "bug" } as never)
      .mockResolvedValueOnce({ id: "label-auth", name: "auth" } as never);

    await syncIssueLabels("project-1", "issue-1", ["bug", "auth", "bug"]);

    expect(prisma.label.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.issueLabel.deleteMany).toHaveBeenCalledWith({
      where: { issueId: "issue-1" },
    });
    expect(prisma.issueLabel.createMany).toHaveBeenCalledWith({
      data: [
        { issueId: "issue-1", labelId: "label-bug" },
        { issueId: "issue-1", labelId: "label-auth" },
      ],
      skipDuplicates: true,
    });
  });

  it("clears links when issue has no labels", async () => {
    await syncIssueLabels("project-1", "issue-1", []);

    expect(prisma.label.upsert).not.toHaveBeenCalled();
    expect(prisma.issueLabel.deleteMany).toHaveBeenCalledWith({
      where: { issueId: "issue-1" },
    });
    expect(prisma.issueLabel.createMany).not.toHaveBeenCalled();
  });
});
