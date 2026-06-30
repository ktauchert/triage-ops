import { prisma } from "@gridnull/db";
import type { Prisma } from "@prisma/client";

export type AuditEventInput = {
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logAuditEvent(input: AuditEventInput) {
  return prisma.auditEvent.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
    },
  });
}

export type ListAuditEventsInput = {
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listAuditEvents(input: ListAuditEventsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);

  return prisma.auditEvent.findMany({
    where: {
      ...(input.action ? { action: input.action } : {}),
      ...(input.from || input.to
        ? {
            createdAt: {
              ...(input.from ? { gte: input.from } : {}),
              ...(input.to ? { lte: input.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}
