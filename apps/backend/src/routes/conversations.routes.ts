import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { isSalesRole, requireRole } from '../middleware/permissions.js';
import { createActivityLog } from '../services/activityLog.service.js';

const router = Router();

const assignSchema = z.object({
  assignedToId: z.string().min(1).nullable().optional(),
});

const noteCreateSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const noteUpdateSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

router.use(requireAuth);

async function findAuthorizedConversation(req: AuthenticatedRequest, id: string) {
  return prisma.conversation.findFirst({
    where: {
      id,
      companyId: req.auth!.companyId,
      ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
    },
    include: {
      contact: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
  });
}

router.get('/assignees', requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.user.findMany({
      where: {
        companyId: req.auth!.companyId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['AGENT', 'MANAGER'] },
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch assignees' });
  }
});

router.patch('/:id/assign', requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = assignSchema.parse(req.body);
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId },
    });

    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    let assignee: { id: string; firstName: string; lastName: string } | null = null;
    if (payload.assignedToId) {
      assignee = await prisma.user.findFirst({
        where: {
          id: payload.assignedToId,
          companyId: req.auth!.companyId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!assignee) return res.status(404).json({ success: false, error: 'Assignee not found' });
    }

    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          assignedToId: payload.assignedToId || null,
          status: payload.assignedToId ? 'ASSIGNED' : 'OPEN',
        },
        include: {
          contact: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      await createActivityLog(
        {
          companyId: req.auth!.companyId,
          eventType: ACTIVITY_TYPES.CONVERSATION_ASSIGNED,
          contactId: conversation.contactId,
          conversationId: conversation.id,
          userId: req.auth!.userId,
          metadata: {
            assignedToId: payload.assignedToId || null,
            assignedToName: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
          },
        },
        tx,
      );

      return updated;
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to assign conversation' });
  }
});

router.get('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const conversation = await findAuthorizedConversation(req, req.params.id);
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const data = await prisma.note.findMany({
      where: { conversationId: conversation.id },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch conversation notes' });
  }
});

router.post('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = noteCreateSchema.parse(req.body);
    const conversation = await findAuthorizedConversation(req, req.params.id);
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    const data = await prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          content: payload.content,
          contactId: conversation.contactId,
          conversationId: conversation.id,
          createdById: req.auth!.userId,
        },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      });

      await createActivityLog(
        {
          companyId: req.auth!.companyId,
          eventType: ACTIVITY_TYPES.CONVERSATION_NOTE_CREATED,
          contactId: conversation.contactId,
          conversationId: conversation.id,
          userId: req.auth!.userId,
          metadata: { noteId: note.id },
        },
        tx,
      );

      return note;
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to add conversation note' });
  }
});

router.patch('/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = noteUpdateSchema.parse(req.body);
    const note = await prisma.note.findFirst({
      where: {
        id: req.params.noteId,
        conversation: {
          companyId: req.auth!.companyId,
          ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
        },
      },
    });

    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });

    const data = await prisma.note.update({
      where: { id: note.id },
      data: { content: payload.content },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update conversation note' });
  }
});

router.delete('/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await prisma.note.findFirst({
      where: {
        id: req.params.noteId,
        conversation: {
          companyId: req.auth!.companyId,
          ...(isSalesRole(req.auth!.role) ? { assignedToId: req.auth!.userId } : {}),
        },
      },
    });

    if (!note) return res.status(404).json({ success: false, error: 'Note not found' });
    await prisma.note.delete({ where: { id: note.id } });
    res.json({ success: true, message: 'Note deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete conversation note' });
  }
});

export default router;
