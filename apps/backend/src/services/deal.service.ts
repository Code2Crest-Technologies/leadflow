import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { getDealWhere } from '../middleware/permissions.js';
import { createActivityLog } from './activityLog.service.js';
import { getDealOnboardingPanel } from './clientOnboarding.service.js';

export const dealSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  value: z.coerce.number().nonnegative().default(0),
  currency: z.string().min(3).max(3).default('INR'),
  stage: z
    .enum(['PROSPECT', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'])
    .default('PROSPECT'),
  probability: z.coerce.number().int().min(0).max(100).default(0),
});

export const dealStageSchema = z.object({
  stage: z.enum(['PROSPECT', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']),
});

export type DealPayload = z.infer<typeof dealSchema>;
export type DealStagePayload = z.infer<typeof dealStageSchema>;

interface AuthContext {
  userId: string;
  companyId: string;
  email: string;
  role: string;
}

export async function listDeals(auth: AuthContext) {
  return prisma.deal.findMany({
    where: getDealWhere(auth),
    include: {
      contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createDeal(auth: AuthContext, payload: DealPayload) {
  const contact = await prisma.contact.findFirst({
    where: { id: payload.contactId, companyId: auth.companyId },
  });

  if (!contact) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        ...payload,
        companyId: auth.companyId,
        assignedToId: auth.userId,
      },
      include: { contact: true },
    });

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.DEAL_CREATED,
        contactId: deal.contactId,
        dealId: deal.id,
        userId: auth.userId,
        metadata: { title: deal.title, stage: deal.stage },
      },
      tx,
    );

    return deal;
  });
}

export async function updateDeal(auth: AuthContext, dealId: string, payload: DealPayload) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
  });

  if (!existing) {
    return null;
  }

  const contact = await prisma.contact.findFirst({
    where: { id: payload.contactId, companyId: auth.companyId },
  });

  if (!contact) {
    return 'CONTACT_NOT_FOUND' as const;
  }

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: {
        ...payload,
        closedAt: ['WON', 'LOST'].includes(payload.stage) ? existing.closedAt || new Date() : null,
      },
      include: { contact: true },
    });

    if (existing.stage !== payload.stage) {
      await createActivityLog(
        {
          companyId: auth.companyId,
          eventType: ACTIVITY_TYPES.DEAL_STAGE_CHANGED,
          contactId: deal.contactId,
          dealId: deal.id,
          userId: auth.userId,
          metadata: { from: existing.stage, to: payload.stage },
        },
        tx,
      );
    }

    return deal;
  });
}

export async function updateDealStage(auth: AuthContext, dealId: string, payload: DealStagePayload) {
  const existing = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
  });

  if (!existing) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.update({
      where: { id: existing.id },
      data: {
        stage: payload.stage,
        closedAt: ['WON', 'LOST'].includes(payload.stage) ? new Date() : null,
      },
    });

    if (existing.stage !== payload.stage) {
      await createActivityLog(
        {
          companyId: auth.companyId,
          eventType: ACTIVITY_TYPES.DEAL_STAGE_CHANGED,
          contactId: existing.contactId,
          dealId: existing.id,
          userId: auth.userId,
          metadata: { from: existing.stage, to: payload.stage },
        },
        tx,
      );
    }

    return deal;
  });
}

export async function getDealWorkspace(auth: AuthContext, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
    include: {
      contact: true,
      tasks: {
        include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { dueDate: 'asc' },
      },
      quotations: {
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
      },
      notes: {
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!deal) {
    return null;
  }

  const { contact, tasks, quotations, activityLogs, notes, ...dealData } = deal;

  return {
    deal: dealData,
    contact,
    tasks,
    quotations,
    activities: activityLogs,
    notes,
    onboarding: await getDealOnboardingPanel(auth, deal.id),
  };
}

export async function getDealTimeline(auth: AuthContext, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
    select: { id: true },
  });

  if (!deal) {
    return null;
  }

  return prisma.activityLog.findMany({
    where: { dealId: deal.id, companyId: auth.companyId },
    select: {
      id: true,
      eventType: true,
      metadata: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
