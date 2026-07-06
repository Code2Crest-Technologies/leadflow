// src/controllers/authController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import authService, { AuthenticationError } from '../services/authService.js';
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

const ssoPayloadSchema = z.object({
  product: z.literal('leadflow'),
  companyId: z.string().min(1),
  companyName: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.string().optional(),
});

const ssoCallbackSchema = z.object({
  token: z.string().min(1),
});

const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret';
const JWT_EXPIRE = process.env.JWT_EXPIRY || process.env.JWT_EXPIRE || '7d';

function normalizeRole(role?: string): 'ADMIN' | 'MANAGER' | 'AGENT' {
  const upperRole = role?.toUpperCase();
  if (upperRole === 'ADMIN' || upperRole === 'MANAGER') return upperRole;
  return 'AGENT';
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
      const role = normalizeRole(payload.role);
      const { firstName, lastName } = splitName(payload);

      const session = await prisma.$transaction(async (tx) => {
        const company = await tx.company.upsert({
          where: { id: payload.companyId },
          create: {
            id: payload.companyId,
            name: payload.companyName,
            whatsappPhoneNumber: `sso-${payload.companyId}`,
            whatsappBusinessAccountId: `sso-${payload.companyId}`,
            whatsappAccessToken: 'managed-by-unified-portal',
          },
          update: {
            name: payload.companyName,
          },
        });

        const existingUser =
          (await tx.user.findUnique({ where: { id: payload.userId } })) ||
          (await tx.user.findUnique({ where: { email: payload.email } }));

        const passwordHash = await bcrypt.hash(`sso:${payload.userId}:${payload.email}`, 10);
        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                email: payload.email,
                firstName,
                lastName,
                companyId: company.id,
                role,
                status: 'ACTIVE',
                lastLoginAt: new Date(),
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
                id: payload.userId,
                email: payload.email,
                firstName,
                lastName,
                companyId: company.id,
                role,
                status: 'ACTIVE',
                passwordHash,
                lastLoginAt: new Date(),
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
