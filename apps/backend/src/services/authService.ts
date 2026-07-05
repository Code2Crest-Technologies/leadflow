// src/services/authService.ts

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'development-only-secret';
const JWT_EXPIRE = (process.env.JWT_EXPIRY ||
  process.env.JWT_EXPIRE ||
  '7d') as SignOptions['expiresIn'];

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}

interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyId: string;
}

interface LoginPayload {
  email: string;
  password: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export const authService = {
  /**
   * Register a new user
   */
  async register(payload: RegisterPayload) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(payload.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: payload.email,
          passwordHash,
          firstName: payload.firstName,
          lastName: payload.lastName,
          companyId: payload.companyId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          companyId: true,
          createdAt: true,
        },
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, companyId: user.companyId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      logger.info(`User registered: ${user.email}`);

      return {
        success: true,
        user,
        token,
      };
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  },

  /**
   * Login user
   */
  async login(payload: LoginPayload) {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: payload.email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          companyId: true,
          passwordHash: true,
          status: true,
          lastLoginAt: true,
          deletedAt: true,
        },
      });

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      if (user.deletedAt) {
        throw new AuthenticationError('User account has been deleted');
      }

      // Check user status
      if (user.status === 'INACTIVE') {
        throw new AuthenticationError('User account is inactive');
      }

      if (user.status === 'SUSPENDED') {
        throw new AuthenticationError('User account is suspended');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        payload.password,
        user.passwordHash
      );

      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, companyId: user.companyId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      logger.info(`User logged in: ${user.email}`);

      const { passwordHash, deletedAt, ...userWithoutPassword } = user;

      return {
        success: true,
        user: userWithoutPassword,
        token,
      };
    } catch (error) {
      if (!(error instanceof AuthenticationError)) {
        logger.error({ err: error }, 'Login service failed');
      }
      throw error;
    }
  },

  /**
   * Verify JWT token
   */
  async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      logger.error('Token verification error:', error);
      throw new Error('Invalid or expired token');
    }
  },
};

export default authService;
