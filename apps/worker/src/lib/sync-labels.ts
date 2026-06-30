import { prisma } from "@gridnull/db";

export async function syncIssueLabels(
  projectId: string,
  issueId: string,
  labelNames: string[],
): Promise<void> {
  const uniqueNames = [...new Set(labelNames.map((name) => name.trim()).filter(Boolean))];

  const labelIds: string[] = [];
  for (const name of uniqueNames) {
    const label = await prisma.label.upsert({
      where: {
        projectId_name: {
          projectId,
          name,
        },
      },
      create: {
        projectId,
        name,
      },
      update: {},
    });
    labelIds.push(label.id);
  }

  await prisma.issueLabel.deleteMany({
    where: { issueId },
  });

  if (labelIds.length > 0) {
    await prisma.issueLabel.createMany({
      data: labelIds.map((labelId) => ({ issueId, labelId })),
      skipDuplicates: true,
    });
  }
}
