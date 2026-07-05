import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';

const router = Router();

const groupSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.contactGroup.findMany({
      where: { companyId: req.auth!.companyId },
      include: {
        _count: { select: { contacts: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch contact groups' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = groupSchema.parse(req.body);
    const data = await prisma.contactGroup.create({
      data: {
        name: payload.name,
        companyId: req.auth!.companyId,
      },
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }

    res.status(409).json({ success: false, error: 'A group with this name already exists' });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = groupSchema.parse(req.body);
    const existing = await prisma.contactGroup.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact group not found' });
    }

    const data = await prisma.contactGroup.update({
      where: { id: existing.id },
      data: { name: payload.name },
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }

    res.status(409).json({ success: false, error: 'A group with this name already exists' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.contactGroup.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Contact group not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.contact.updateMany({
        where: { groupId: existing.id },
        data: { groupId: null },
      });

      await tx.contactGroup.delete({
        where: { id: existing.id },
      });
    });

    res.json({ success: true, message: 'Contact group deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete contact group' });
  }
});

export default router;
