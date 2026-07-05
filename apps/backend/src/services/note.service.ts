import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { createActivityLog } from './activityLog.service.js';

export const noteCreateSchema = z
  .object({
    dealId: z.string().optional().or(z.literal('')),
    contactId: z.string().optional().or(z.literal('')),
    content: z.string().trim().min(1).max(5000),
  })
  .refine((payload) => Boolean(payload.dealId || payload.contactId), {
    message: 'A dealId or contactId is required',
    path: ['dealId'],
  });

export const noteListSchema = z.object({
  dealId: z.string().optional(),
  contactId: z.string().optional(),
});

export const noteUpdateSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

interface AuthContext {
  userId: string;
  companyId: string;
}

async function getAuthorizedRelation(companyId: string, dealId?: string | null, contactId?: string | null) {
  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, companyId },
      select: { id: true, contactId: true },
    });
    return deal ? { dealId: deal.id, contactId: contactId || deal.contactId } : null;
  }

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, companyId },
      select: { id: true },
    });
    return contact ? { dealId: null, contactId: contact.id } : null;
  }

  return null;
}

async function getAuthorizedNote(companyId: string, id: string) {
  const note = await prisma.note.findUnique({
    where: { id },
    include: {
      deal: { select: { companyId: true } },
      contact: { select: { companyId: true } },
    },
  });

  if (!note) return null;

  const relationCompanyId = note.deal?.companyId || note.contact?.companyId;
  return relationCompanyId === companyId ? note : null;
}

export async function listNotes(auth: AuthContext, query: z.infer<typeof noteListSchema>) {
  const relation = await getAuthorizedRelation(auth.companyId, query.dealId, query.contactId);
  if (!relation) return null;

  return prisma.note.findMany({
    where: {
      dealId: query.dealId || undefined,
      contactId: !query.dealId && query.contactId ? query.contactId : undefined,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createNote(auth: AuthContext, payload: z.infer<typeof noteCreateSchema>) {
  const relation = await getAuthorizedRelation(
    auth.companyId,
    payload.dealId || null,
    payload.contactId || null,
  );
  if (!relation) return null;

  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        content: payload.content,
        dealId: relation.dealId,
        contactId: relation.contactId,
        createdById: auth.userId,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (relation.dealId) {
      await createActivityLog(
        {
          companyId: auth.companyId,
          eventType: ACTIVITY_TYPES.NOTE_CREATED,
          contactId: relation.contactId,
          dealId: relation.dealId,
          userId: auth.userId,
          metadata: { noteId: note.id },
        },
        tx,
      );
    }

    return note;
  });
}

export async function updateNote(auth: AuthContext, id: string, payload: z.infer<typeof noteUpdateSchema>) {
  const note = await getAuthorizedNote(auth.companyId, id);
  if (!note) return null;

  return prisma.note.update({
    where: { id: note.id },
    data: { content: payload.content },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function deleteNote(auth: AuthContext, id: string) {
  const note = await getAuthorizedNote(auth.companyId, id);
  if (!note) return false;

  await prisma.note.delete({ where: { id: note.id } });
  return true;
}
