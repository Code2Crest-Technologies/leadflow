import crypto from 'crypto';
import { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import type { AuthPayload } from '../types/index.js';
import { getInvoiceWhere } from '../middleware/permissions.js';
import { createActivityLog } from './activityLog.service.js';
import { invoiceInclude } from './invoice.service.js';

export const billingProfileSchema = z.object({
  legalName: z.string().trim().min(1),
  gstin: z.string().trim().optional().nullable(),
  gstRegistrationStatus: z.enum(['REGISTERED', 'UNREGISTERED', 'COMPOSITION', 'OVERSEAS']).default('UNREGISTERED'),
  country: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  addressLine1: z.string().trim().optional().nullable(),
  addressLine2: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  postalCode: z.string().trim().optional().nullable(),
  phoneCountryCode: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  bankDetails: z.string().trim().optional().nullable(),
  defaultPaymentTerms: z.string().trim().optional().nullable(),
});

export const publicLinkSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
});

export const razorpayOrderSchema = z.object({
  amount: z.coerce.number().positive().optional(),
});

export const razorpayVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const paymentMilestoneSchema = z.object({
  projectId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  amount: z.coerce.number().nonnegative().default(0),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'WAIVED']).default('PENDING'),
  sortOrder: z.coerce.number().int().default(0),
});

export const paymentMilestoneQuerySchema = z.object({
  projectId: z.string().optional(),
  invoiceId: z.string().optional(),
  status: z.enum(['PENDING', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'WAIVED']).optional(),
});

function frontendBaseUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function moneyNumber(value: unknown) {
  return Number(value || 0);
}

async function nextReceiptNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `RCT-${year}-`;
  const latest = await prisma.receipt.findFirst({
    where: { companyId, receiptNumber: { startsWith: prefix } },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  });
  const next = latest ? Number(latest.receiptNumber.split('-').pop() || 0) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function nextStatus(total: number, paid: number, dueDate?: Date | null): InvoiceStatus {
  const balance = Math.max(total - paid, 0);
  if (paid >= total && total > 0) return InvoiceStatus.PAID;
  if (paid > 0 && balance > 0) return InvoiceStatus.PARTIALLY_PAID;
  if (dueDate && dueDate < new Date() && balance > 0) return InvoiceStatus.OVERDUE;
  return InvoiceStatus.SENT;
}

export async function getBillingProfile(auth: AuthPayload) {
  const profile = await prisma.billingProfile.findFirst({
    where: { companyId: auth.companyId, isDefault: true },
  });
  if (profile) return profile;

  const company = await prisma.company.findUnique({ where: { id: auth.companyId } });
  if (!company) return null;

  return {
    id: '',
    companyId: auth.companyId,
    legalName: company.name,
    gstin: company.gstin,
    gstRegistrationStatus: company.gstin ? 'REGISTERED' : 'UNREGISTERED',
    country: company.country || 'India',
    state: company.state,
    addressLine1: company.addressLine1,
    addressLine2: company.addressLine2,
    city: company.city,
    postalCode: company.postalCode || company.pincode,
    phoneCountryCode: company.phoneCountryCode,
    phone: company.phone,
    email: company.email,
    website: company.website,
    bankDetails: company.bankDetails,
    defaultPaymentTerms: 'On approval',
    isDefault: true,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export async function upsertBillingProfile(auth: AuthPayload, payload: z.infer<typeof billingProfileSchema>) {
  const existing = await prisma.billingProfile.findFirst({
    where: { companyId: auth.companyId, isDefault: true },
    select: { id: true },
  });

  const data = {
    ...payload,
    country: payload.country || 'India',
    defaultPaymentTerms: payload.defaultPaymentTerms || 'On approval',
    isDefault: true,
  };

  if (existing) {
    return prisma.billingProfile.update({ where: { id: existing.id }, data });
  }

  return prisma.billingProfile.create({
    data: {
      companyId: auth.companyId,
      ...data,
    },
  });
}

export async function listPaymentMilestones(auth: AuthPayload, query: z.infer<typeof paymentMilestoneQuerySchema>) {
  return prisma.paymentMilestone.findMany({
    where: {
      companyId: auth.companyId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      project: { select: { id: true, name: true, status: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, balanceDue: true } },
    },
  });
}

export async function createPaymentMilestone(auth: AuthPayload, payload: z.infer<typeof paymentMilestoneSchema>) {
  if (payload.projectId) {
    const project = await prisma.project.findFirst({ where: { id: payload.projectId, companyId: auth.companyId } });
    if (!project) return { error: 'Project not found' as const };
  }
  if (payload.invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: payload.invoiceId, ...getInvoiceWhere(auth) } });
    if (!invoice) return { error: 'Invoice not found' as const };
  }

  return prisma.paymentMilestone.create({
    data: {
      companyId: auth.companyId,
      projectId: payload.projectId || null,
      invoiceId: payload.invoiceId || null,
      title: payload.title,
      description: payload.description,
      percentage: payload.percentage,
      amount: payload.amount,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      status: payload.status,
      sortOrder: payload.sortOrder,
    },
  });
}

export async function updatePaymentMilestone(auth: AuthPayload, id: string, payload: Partial<z.infer<typeof paymentMilestoneSchema>>) {
  const existing = await prisma.paymentMilestone.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) return null;

  return prisma.paymentMilestone.update({
    where: { id: existing.id },
    data: {
      title: payload.title,
      description: payload.description,
      percentage: payload.percentage,
      amount: payload.amount,
      dueDate: payload.dueDate === undefined ? undefined : payload.dueDate ? new Date(payload.dueDate) : null,
      status: payload.status,
      sortOrder: payload.sortOrder,
    },
  });
}

async function createInvoiceLink(invoiceId: string, expiresAt?: Date | null) {
  const token = createToken();
  const record = await prisma.invoicePublicToken.create({
    data: {
      invoiceId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return {
    token,
    url: `${frontendBaseUrl()}/public/invoices/${token}`,
    expiresAt: record.expiresAt,
  };
}

export async function createInvoicePublicLink(auth: AuthPayload, invoiceId: string, payload: z.infer<typeof publicLinkSchema>) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ...getInvoiceWhere(auth) } });
  if (!invoice) return null;
  const link = await createInvoiceLink(invoice.id, payload.expiresAt ? new Date(payload.expiresAt) : null);

  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.INVOICE_PUBLIC_LINK_CREATED,
    contactId: invoice.contactId,
    dealId: invoice.dealId,
    projectId: invoice.projectId,
    userId: auth.userId,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
  });

  return link;
}

export async function finalizeInvoice(auth: AuthPayload, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ...getInvoiceWhere(auth) } });
  if (!invoice) return null;
  if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.VOID) {
    return { error: 'Cancelled invoices cannot be finalized' as const };
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: invoice.status === InvoiceStatus.DRAFT ? InvoiceStatus.FINALIZED : invoice.status,
      finalizedAt: invoice.finalizedAt || new Date(),
    },
    include: invoiceInclude,
  });

  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.INVOICE_FINALIZED,
    contactId: updated.contactId,
    dealId: updated.dealId,
    projectId: updated.projectId,
    userId: auth.userId,
    metadata: { invoiceId: updated.id, invoiceNumber: updated.invoiceNumber },
  });

  return updated;
}

export async function sendInvoice(auth: AuthPayload, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ...getInvoiceWhere(auth) } });
  if (!invoice) return null;
  if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.VOID) {
    return { error: 'Cancelled invoices cannot be sent' as const };
  }

  const link = await createInvoiceLink(invoice.id, null);
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.SENT, sentAt: new Date(), finalizedAt: invoice.finalizedAt || new Date() },
    include: invoiceInclude,
  });

  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.INVOICE_SENT,
    contactId: updated.contactId,
    dealId: updated.dealId,
    projectId: updated.projectId,
    userId: auth.userId,
    metadata: { invoiceId: updated.id, invoiceNumber: updated.invoiceNumber, publicUrl: link.url },
  });

  return { invoice: updated, publicUrl: link.url, token: link.token };
}

export async function getPublicInvoice(token: string) {
  const publicToken = await prisma.invoicePublicToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { invoice: { include: invoiceInclude } },
  });

  if (!publicToken || publicToken.revokedAt) return null;
  if (publicToken.expiresAt && publicToken.expiresAt < new Date()) return null;

  await prisma.invoicePublicToken.update({
    where: { id: publicToken.id },
    data: { lastViewedAt: new Date() },
  });

  const invoice = await prisma.invoice.update({
    where: { id: publicToken.invoiceId },
    data: {
      viewedAt: new Date(),
      status: publicToken.invoice.status === InvoiceStatus.SENT ? InvoiceStatus.VIEWED : publicToken.invoice.status,
    },
    include: invoiceInclude,
  });

  return invoice;
}

export async function createRazorpayOrder(auth: AuthPayload, invoiceId: string, payload: z.infer<typeof razorpayOrderSchema>) {
  if ((process.env.RAZORPAY_MODE || 'test') !== 'test') {
    return { error: 'Razorpay live mode is disabled for this LeadFlow build' as const };
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return { error: 'Razorpay test credentials are not configured' as const };

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ...getInvoiceWhere(auth) } });
  if (!invoice) return null;
  const amount = Math.min(Number(payload.amount || invoice.balanceDue || invoice.amountDue), moneyNumber(invoice.balanceDue || invoice.amountDue));
  if (amount <= 0) return { error: 'Invoice has no payable balance' as const };

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: invoice.currency || 'INR',
      receipt: invoice.invoiceNumber,
      notes: { invoiceId: invoice.id, companyId: auth.companyId },
    }),
  });

  if (!response.ok) return { error: 'Razorpay order creation failed' as const };
  const order = (await response.json()) as { id: string; amount: number; currency: string };
  const payment = await prisma.payment.create({
    data: {
      companyId: auth.companyId,
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      contactId: invoice.contactId,
      amount,
      currency: order.currency || invoice.currency || 'INR',
      method: PaymentMethod.RAZORPAY,
      status: PaymentStatus.PENDING,
      provider: 'RAZORPAY',
      providerOrderId: order.id,
      recordedById: auth.userId,
      metadata: order as Prisma.InputJsonValue,
    },
  });

  return { keyId, orderId: order.id, amount: order.amount, currency: order.currency, paymentId: payment.id };
}

export async function verifyRazorpayPayment(auth: AuthPayload, invoiceId: string, payload: z.infer<typeof razorpayVerifySchema>) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return { error: 'Razorpay test credentials are not configured' as const };

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${payload.razorpayOrderId}|${payload.razorpayPaymentId}`)
    .digest('hex');
  if (
    expected.length !== payload.razorpaySignature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(payload.razorpaySignature))
  ) {
    return { error: 'Invalid Razorpay signature' as const };
  }

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, ...getInvoiceWhere(auth) } });
  if (!invoice) return null;
  const existingSuccess = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id, provider: 'RAZORPAY', providerPaymentId: payload.razorpayPaymentId, status: PaymentStatus.SUCCESS },
    include: { receipts: true },
  });
  if (existingSuccess) return existingSuccess;

  const pending = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id, provider: 'RAZORPAY', providerOrderId: payload.razorpayOrderId },
  });
  if (!pending) return { error: 'Payment order was not found' as const };

  const updatedPayment = await prisma.payment.update({
    where: { id: pending.id },
    data: {
      status: PaymentStatus.SUCCESS,
      providerPaymentId: payload.razorpayPaymentId,
      providerSignature: payload.razorpaySignature,
      paidAt: new Date(),
    },
  });

  const paid = Math.min(moneyNumber(invoice.amountPaid) + moneyNumber(updatedPayment.amount), moneyNumber(invoice.total));
  const balanceDue = Math.max(moneyNumber(invoice.total) - paid, 0);
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: paid, balanceDue, amountDue: balanceDue, status: nextStatus(moneyNumber(invoice.total), paid, invoice.dueDate) },
  });

  const receipt = await prisma.receipt.create({
    data: {
      companyId: auth.companyId,
      invoiceId: invoice.id,
      paymentId: updatedPayment.id,
      projectId: invoice.projectId,
      receiptNumber: await nextReceiptNumber(auth.companyId),
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      metadata: { provider: 'RAZORPAY' },
    },
  });

  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.INVOICE_PAYMENT_RECORDED,
    contactId: invoice.contactId,
    dealId: invoice.dealId,
    projectId: invoice.projectId,
    userId: auth.userId,
    metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, paymentId: updatedPayment.id, receiptId: receipt.id },
  });

  return { ...updatedPayment, receipts: [receipt] };
}

export async function getAdvancePaymentReadiness(companyId: string, projectId?: string | null, dealId?: string | null) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      companyId,
      OR: [
        ...(projectId ? [{ projectId }] : []),
        ...(dealId ? [{ dealId }] : []),
      ],
      status: { in: [InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.PAID] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!invoice) {
    return { status: 'WARNING' as const, message: 'No advance payment has been recorded yet.' };
  }

  return {
    status: 'PASSED' as const,
    message: `Advance payment recorded against ${invoice.invoiceNumber}.`,
  };
}
