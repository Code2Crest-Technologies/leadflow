import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getDealWhere, getTaskWhere } from '../middleware/permissions.js';
import { createActivityLog } from '../services/activityLog.service.js';

const router = Router();

const taskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional().or(z.literal('')),
  contactId: z.string().optional().or(z.literal('')),
  dealId: z.string().optional().or(z.literal('')),
  dueDate: z.coerce.date(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  assignedTo: z.string().optional().or(z.literal('')),
});

router.use(requireAuth);

async function ensureTaskRelations(
  auth: NonNullable<AuthenticatedRequest['auth']>,
  contactId: string | null,
  dealId: string | null,
) {
  let contactExists = false;

  if (contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, companyId: auth.companyId },
    });
    if (!contact) return 'Contact not found';
    contactExists = true;
  }

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, ...getDealWhere(auth) },
    });
    if (!deal) return 'Deal not found';
    if (contactExists && deal.contactId !== contactId) return 'Deal does not belong to selected contact';
  }

  return null;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.task.findMany({
      where: getTaskWhere(req.auth!),
      include: {
        contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
        deal: { select: { title: true, stage: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = taskSchema.parse(req.body);
    const contactId = payload.contactId || null;
    const dealId = payload.dealId || null;
    const relationError = await ensureTaskRelations(req.auth!, contactId, dealId);
    if (relationError) return res.status(404).json({ success: false, error: relationError });

    const data = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: payload.title,
          description: payload.description,
          contactId,
          dealId,
          dueDate: payload.dueDate,
          status: payload.status,
          assignedToId: payload.assignedTo || req.auth!.userId,
          companyId: req.auth!.companyId,
        },
        include: {
          contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
          deal: { select: { title: true, stage: true } },
        },
      });

      if (dealId) {
        await createActivityLog(
          {
            companyId: req.auth!.companyId,
            eventType: ACTIVITY_TYPES.TASK_CREATED,
            contactId,
            dealId,
            userId: req.auth!.userId,
            metadata: { taskId: task.id, title: task.title, dueDate: task.dueDate.toISOString() },
          },
          tx,
        );
      }

      return task;
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = taskSchema.parse(req.body);
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ...getTaskWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

    const contactId = payload.contactId || null;
    const dealId = payload.dealId || null;
    const relationError = await ensureTaskRelations(req.auth!, contactId, dealId);
    if (relationError) return res.status(404).json({ success: false, error: relationError });

    const data = await prisma.task.update({
      where: { id: existing.id },
      data: {
        title: payload.title,
        description: payload.description,
        contactId,
        dealId,
        dueDate: payload.dueDate,
        status: payload.status,
        assignedToId: payload.assignedTo || existing.assignedToId || req.auth!.userId,
      },
      include: {
        contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
        deal: { select: { title: true, stage: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = z
      .object({ status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']) })
      .parse(req.body);
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ...getTaskWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

    const data = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: existing.id },
        data: { status },
      });

      if (status === 'COMPLETED' && existing.status !== 'COMPLETED' && existing.dealId) {
        await createActivityLog(
          {
            companyId: req.auth!.companyId,
            eventType: ACTIVITY_TYPES.TASK_COMPLETED,
            contactId: existing.contactId,
            dealId: existing.dealId,
            userId: req.auth!.userId,
            metadata: { taskId: existing.id, title: existing.title },
          },
          tx,
        );
      }

      return task;
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, ...getTaskWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

    await prisma.task.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Task deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
});

export default router;
