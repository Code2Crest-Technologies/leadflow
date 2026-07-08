import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { UserStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).default('AGENT'),
});

const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8)
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[0-9]/, 'Password must include a number')
    .regex(/[^A-Za-z0-9]/, 'Password must include a symbol'),
});

async function ensureNotLastActiveAdmin(userId: string, companyId: string) {
  const target = await prisma.user.findFirst({
    where: { id: userId, companyId, deletedAt: null },
    select: { role: true, status: true },
  });
  if (!target || target.role !== 'ADMIN' || target.status !== 'ACTIVE') return null;

  const activeAdminCount = await prisma.user.count({
    where: { companyId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
  });

  return activeAdminCount <= 1 ? 'At least one active admin is required' : null;
}

function ensureNotSelfDestructiveAction(
  currentUserId: string,
  targetUserId: string,
  payload: { role?: string; status?: string; delete?: boolean },
) {
  if (currentUserId !== targetUserId) return null;
  if (payload.delete) return 'You cannot delete or deactivate your own admin account';
  if (payload.status && payload.status !== 'ACTIVE') return 'You cannot deactivate your own admin account';
  if (payload.role && payload.role !== 'ADMIN') return 'You cannot remove your own admin role';
  return null;
}

router.use(requireAuth);

router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.user.findFirst({
      where: { id: req.auth!.userId, companyId: req.auth!.companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!data) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

router.patch('/me/password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = changeOwnPasswordSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { id: req.auth!.userId, companyId: req.auth!.companyId, deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
        authProvider: true,
        status: true,
      },
    });

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.status !== 'ACTIVE') return res.status(403).json({ success: false, error: 'Account is not active' });
    if (user.authProvider === 'PORTAL') {
      return res.status(403).json({ success: false, error: 'This account is managed through Code2Crest Hub.' });
    }

    const validPassword = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!validPassword) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(payload.newPassword, 10) },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

router.use(requireRole('ADMIN'));

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.user.findMany({
      where: { companyId: req.auth!.companyId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });

    if (existing && !existing.deletedAt) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    const userData = {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        status: UserStatus.ACTIVE,
        companyId: req.auth!.companyId,
        passwordHash: await bcrypt.hash(payload.password, 10),
        deletedAt: null,
      };

    const data = existing
      ? await prisma.user.update({
      where: { id: existing.id },
      data: userData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
      : await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = updateUserSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId, deletedAt: null },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const selfError = ensureNotSelfDestructiveAction(req.auth!.userId, existing.id, payload);
    if (selfError) return res.status(400).json({ success: false, error: selfError });

    if (
      existing.role === 'ADMIN' &&
      existing.status === 'ACTIVE' &&
      ((payload.role && payload.role !== 'ADMIN') || (payload.status && payload.status !== 'ACTIVE'))
    ) {
      const lastAdminError = await ensureNotLastActiveAdmin(existing.id, req.auth!.companyId);
      if (lastAdminError) return res.status(400).json({ success: false, error: lastAdminError });
    }

    if (payload.email && payload.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: payload.email } });
      if (duplicate && duplicate.id !== existing.id && !duplicate.deletedAt) {
        return res.status(409).json({ success: false, error: 'Email is already in use' });
      }
    }

    const data = await prisma.user.update({
      where: { id: existing.id },
      data: payload,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.patch('/:id/password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = resetPasswordSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId, deletedAt: null },
    });

    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await bcrypt.hash(payload.password, 10) },
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId, deletedAt: null },
    });

    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

    const selfError = ensureNotSelfDestructiveAction(req.auth!.userId, existing.id, { delete: true });
    if (selfError) return res.status(400).json({ success: false, error: selfError });

    const lastAdminError = await ensureNotLastActiveAdmin(existing.id, req.auth!.companyId);
    if (lastAdminError) return res.status(400).json({ success: false, error: lastAdminError });

    const data = await prisma.user.update({
      where: { id: existing.id },
      data: { status: 'INACTIVE', deletedAt: new Date() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: 'User deleted from team. Historical records remain.',
      data,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
