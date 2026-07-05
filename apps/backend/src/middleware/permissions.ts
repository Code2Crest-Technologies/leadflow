import { NextFunction, Response } from 'express';
import type { Prisma } from '@prisma/client';
import type { AuthPayload } from '../types';
import type { AuthenticatedRequest } from './auth';

export type AppRole = 'ADMIN' | 'MANAGER' | 'AGENT';

export function isSalesRole(role?: string) {
  return role === 'AGENT';
}

export function requireRole(...roles: AppRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.auth?.role as AppRole | undefined;

    if (!role || !roles.includes(role)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    next();
  };
}

export function requirePermission(permission: string) {
  const permissionRoles: Record<string, AppRole[]> = {
    'analytics:view': ['ADMIN', 'MANAGER'],
    'users:manage': ['ADMIN'],
    'company:manage': ['ADMIN'],
  };

  return requireRole(...(permissionRoles[permission] || ['ADMIN']));
}

export function canSeeCompanyData(auth: AuthPayload) {
  return auth.role === 'ADMIN' || auth.role === 'MANAGER';
}

export function getDealWhere(auth: AuthPayload): Prisma.DealWhereInput {
  return {
    companyId: auth.companyId,
    ...(isSalesRole(auth.role) ? { assignedToId: auth.userId } : {}),
  };
}

export function getTaskWhere(auth: AuthPayload): Prisma.TaskWhereInput {
  return {
    companyId: auth.companyId,
    ...(isSalesRole(auth.role) ? { assignedToId: auth.userId } : {}),
  };
}

export function getQuotationWhere(auth: AuthPayload): Prisma.QuotationWhereInput {
  return {
    companyId: auth.companyId,
    ...(isSalesRole(auth.role) ? { deal: { assignedToId: auth.userId } } : {}),
  };
}

export function getInvoiceWhere(auth: AuthPayload): Prisma.InvoiceWhereInput {
  return {
    companyId: auth.companyId,
    ...(isSalesRole(auth.role) ? { deal: { assignedToId: auth.userId } } : {}),
  };
}

export function getMessageWhere(auth: AuthPayload): Prisma.MessageWhereInput {
  return {
    companyId: auth.companyId,
    ...(isSalesRole(auth.role)
      ? {
          OR: [
            { senderId: auth.userId },
            { conversation: { assignedToId: auth.userId } },
          ],
        }
      : {}),
  };
}
