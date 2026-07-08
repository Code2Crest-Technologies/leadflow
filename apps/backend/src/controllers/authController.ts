// src/controllers/authController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import authService, { AuthenticationError, PortalManagedAccountError } from '../services/authService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyId: z.string().min(1, 'Company ID is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const ssoPayloadSchema = z
  .object({
  product: z.string().optional(),
  productKey: z.string().optional(),
  portalCompanyId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  companyName: z.string().min(1),
  portalUserId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  email: z.string().email(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  productAccess: z.unknown().optional(),
  subscriptionExpiresAt: z.string().datetime().optional(),
})
  .refine((payload) => payload.product === 'leadflow' || payload.productKey === 'leadflow', {
    message: 'Invalid product',
    path: ['productKey'],
  })
  .refine((payload) => Boolean(payload.portalCompanyId || payload.companyId), {
    message: 'Portal company ID is required',
    path: ['portalCompanyId'],
  })
  .refine((payload) => Boolean(payload.portalUserId || payload.userId), {
    message: 'Portal user ID is required',
    path: ['portalUserId'],
  });

const ssoCallbackSchema = z.object({
  token: z.string().min(1),
});

const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret';
const JWT_EXPIRE = process.env.JWT_EXPIRY || process.env.JWT_EXPIRE || '7d';

function normalizeRole(role?: string): 'ADMIN' | 'MANAGER' | 'AGENT' {
  const upperRole = role?.toUpperCase();
  if (upperRole === 'OWNER') return 'ADMIN';
  if (upperRole === 'ADMIN' || upperRole === 'MANAGER') return upperRole;
  return 'AGENT';
}

function resolvePortalCompanyId(payload: z.infer<typeof ssoPayloadSchema>) {
  return payload.portalCompanyId || payload.companyId!;
}

function resolvePortalUserId(payload: z.infer<typeof ssoPayloadSchema>) {
  return payload.portalUserId || payload.userId!;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function parseOptionalDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function splitName(payload: z.infer<typeof ssoPayloadSchema>) {
  if (payload.firstName || payload.lastName) {
    return {
      firstName: payload.firstName || payload.name?.split(' ')[0] || 'User',
      lastName: payload.lastName || payload.name?.split(' ').slice(1).join(' ') || 'Account',
    };
  }

  const parts = (payload.name || payload.email.split('@')[0] || 'User').trim().split(/\s+/);
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || 'Account',
  };
}

export const authController = {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  async register(req: Request, res: Response) {
    try {
      if (process.env.ENABLE_PUBLIC_SIGNUP !== 'true') {
        return res.status(403).json({
          success: false,
          error: 'Public signup is disabled. Contact your company administrator.',
        });
      }

      // Validate request body
      const validatedData = registerSchema.parse(req.body);

      const result = await authService.register(validatedData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Registration failed';
      logger.error('Registration error:', error);

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  },

  /**
   * POST /api/auth/login
   * User login
   */
  async login(req: Request, res: Response) {
    try {
      // Validate request body
      const validatedData = loginSchema.parse(req.body);

      logger.info({ email: validatedData.email }, 'Login attempt');

      const result = await authService.login(validatedData);

      logger.info({ email: validatedData.email }, 'Login successful');

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn({ issues: error.errors }, 'Login validation error');
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      if (error instanceof AuthenticationError) {
        logger.warn({ err: error }, 'Login rejected');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        });
      }

      if (error instanceof PortalManagedAccountError) {
        logger.warn({ err: error }, 'Portal-managed account attempted direct login');
        return res.status(403).json({
          success: false,
          error: 'this_account_is_managed_by_portal',
        });
      }

      logger.error({ err: error }, 'Login failed');
      res.status(500).json({
        success: false,
        error: 'Login failed',
      });
    }
  },

  /**
   * POST /api/auth/sso/callback
   * Code2Crest Unified Portal SSO login
   */
  async ssoCallback(req: Request, res: Response) {
    try {
      if (!process.env.SSO_SECRET) {
        logger.error('SSO_SECRET is not configured');
        return res.status(500).json({ success: false, error: 'SSO is not configured' });
      }

      const { token } = ssoCallbackSchema.parse(req.body);
      const decoded = jwt.verify(token, process.env.SSO_SECRET);
      const payload = ssoPayloadSchema.parse(decoded);
      const portalCompanyId = resolvePortalCompanyId(payload);
      const portalUserId = resolvePortalUserId(payload);
      const role = normalizeRole(payload.role);
      const { firstName, lastName } = splitName(payload);
      const now = new Date();

      const session = await prisma.$transaction(async (tx) => {
        const existingCompany =
          (await tx.company.findUnique({ where: { portalCompanyId } })) ||
          (await tx.company.findUnique({ where: { id: portalCompanyId } }));

        const companyData = {
            name: payload.companyName,
            portalCompanyId,
            subscriptionStatus: payload.subscriptionStatus,
            productAccess: toJsonValue(payload.productAccess),
            subscriptionExpiresAt: parseOptionalDate(payload.subscriptionExpiresAt),
            lastPortalSyncAt: now,
          };

        const company = existingCompany
          ? await tx.company.update({
              where: { id: existingCompany.id },
              data: companyData,
            })
          : await tx.company.create({
              data: companyData,
            });

        const existingUser =
          (await tx.user.findUnique({ where: { portalUserId } })) ||
          (await tx.user.findUnique({ where: { id: portalUserId } })) ||
          (await tx.user.findUnique({ where: { email: payload.email } }));

        if (existingUser?.deletedAt || (existingUser?.status !== undefined && existingUser.status !== 'ACTIVE')) {
          throw new Error('SSO_USER_DISABLED');
        }

        if (existingUser && existingUser.companyId !== company.id && !existingUser.portalUserId) {
          throw new Error('SSO_EMAIL_CONFLICT');
        }

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                email: payload.email,
                firstName,
                lastName,
                companyId: company.id,
                role,
                portalUserId,
                portalRole: payload.role ?? null,
                authProvider: existingUser.authProvider === 'LOCAL' ? existingUser.authProvider : 'PORTAL',
                lastLoginAt: now,
              },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                companyId: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
              },
            })
          : await tx.user.create({
              data: {
                email: payload.email,
                firstName,
                lastName,
                companyId: company.id,
                role,
                status: 'ACTIVE',
                portalUserId,
                portalRole: payload.role ?? null,
                authProvider: 'PORTAL',
                passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
                lastLoginAt: now,
              },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
                companyId: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
              },
            });

        await tx.teamMember.upsert({
          where: {
            companyId_userId: {
              companyId: company.id,
              userId: user.id,
            },
          },
          create: {
            companyId: company.id,
            userId: user.id,
            role,
            permissions: [],
          },
          update: {
            role,
          },
        });

        return { company, user };
      });

      const leadflowToken = jwt.sign(
        {
          userId: session.user.id,
          companyId: session.user.companyId,
          email: session.user.email,
          role: session.user.role,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE as jwt.SignOptions['expiresIn'] },
      );

      res.cookie('leadflow_session', leadflowToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        message: 'SSO login successful',
        data: {
          token: leadflowToken,
          user: session.user,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SSO_USER_DISABLED') {
        return res.status(403).json({
          success: false,
          error: 'This user is disabled in LeadFlow. Contact your company administrator.',
        });
      }

      if (error instanceof Error && error.message === 'SSO_EMAIL_CONFLICT') {
        return res.status(409).json({
          success: false,
          error: 'This email is already linked to another LeadFlow workspace.',
        });
      }

      logger.warn({ err: error }, 'SSO login rejected');
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired SSO token',
      });
    }
  },

  /**
   * POST /api/auth/logout
   * User logout (optional - mainly for client-side cleanup)
   */
  async logout(req: Request, res: Response) {
    try {
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  },
};

export default authController;
