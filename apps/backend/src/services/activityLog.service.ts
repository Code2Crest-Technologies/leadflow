import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database.js';
import type { ActivityType } from '../constants/activityTypes.js';

type ActivityLogClient = Pick<PrismaClient, 'activityLog'> | Prisma.TransactionClient;

interface CreateActivityLogInput {
  companyId: string;
  eventType: ActivityType;
  contactId?: string | null;
  userId?: string | null;
  dealId?: string | null;
  conversationId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function createActivityLog(
  input: CreateActivityLogInput,
  client: ActivityLogClient = prisma,
) {
  return client.activityLog.create({
    data: {
      companyId: input.companyId,
      eventType: input.eventType,
      contactId: input.contactId ?? undefined,
      userId: input.userId ?? undefined,
      dealId: input.dealId ?? undefined,
      conversationId: input.conversationId ?? undefined,
      metadata: input.metadata,
    },
  });
}
