// src/controllers/authController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import authService, { AuthenticationError } from '../services/authService';
import { logger } from '../utils/logger';

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
