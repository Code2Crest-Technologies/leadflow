import { InvoiceStatus, InvoiceTaxMode, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthPayload } from '../types/index.js';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { getDealWhere, getInvoiceWhere } from '../middleware/permissions.js';
import { calculateTaxBreakdown } from '../utils/tax.js';
import { createActivityLog } from './activityLog.service.js';

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
  discountAmount: z.coerce.number().nonnegative().default(0),
});

export const invoiceCreateSchema = z.object({
  contactId: z.string().min(1),
  dealId: z.string().optional().or(z.literal('')),
  status: z.nativeEnum(InvoiceStatus).default(InvoiceStatus.DRAFT),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().trim().optional().default('On approval'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  amountPaid: z.coerce.number().nonnegative().default(0),
  items: z.array(invoiceItemSchema).min(1),
});

export const invoiceUpdateSchema = z.object({
  status: z.enum([InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.CANCELLED]).optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  amountPaid: z.coerce.number().nonnegative().optional(),
});

export const invoicePaymentSchema = z.object({
  amountReceived: z.coerce.number().positive(),
  paymentDate: z.string().min(1).optional(),
  notes: z.string().trim().optional(),
});

export const invoiceListQuerySchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  quotationId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type InvoiceCreatePayload = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdatePayload = z.infer<typeof invoiceUpdateSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const invoiceInclude = {
  company: {
    select: {
      name: true,
      gstin: true,
      country: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      pincode: true,
      postalCode: true,
      phoneCountryCode: true,
      phone: true,
      email: true,
      logo: true,
      logoUrl: true,
      website: true,
      signature: true,
      signatureUrl: true,
      quotationTerms: true,
      bankDetails: true,
    },
  },
  contact: true,
  deal: { select: { id: true, title: true, stage: true } },
  project: { select: { id: true, name: true, status: true } },
  quotation: { select: { id: true, quoteNumber: true, status: true } },
  items: true,
  payments: { orderBy: { createdAt: 'desc' as const }, include: { receipts: true } },
  receipts: { orderBy: { issuedAt: 'desc' as const } },
  milestones: { orderBy: { sortOrder: 'asc' as const } },
  publicTokens: { where: { revokedAt: null }, orderBy: { createdAt: 'desc' as const }, take: 1 },
};

function dateOrUndefined(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function moneyNumber(value: unknown) {
  return Number(value || 0);
}

function calculateInvoiceTotals({
  items,
  taxPercent,
  amountPaid = 0,
  companyCountry,
  companyState,
  customerCountry,
  customerState,
}: {
  items: Array<{ description: string; quantity: number; unitPrice: number; discountAmount?: number }>;
  taxPercent: number;
  amountPaid?: number;
  companyCountry?: string | null;
  companyState?: string | null;
  customerCountry?: string | null;
  customerState?: string | null;
}) {
  const calculatedItems = items.map((item) => ({
    ...item,
    discountAmount: Math.min(Number(item.discountAmount || 0), Number(item.quantity || 1) * Number(item.unitPrice || 0)),
    taxableAmount: Math.max(Number(item.quantity || 1) * Number(item.unitPrice || 0) - Number(item.discountAmount || 0), 0),
    total: Math.max(Number(item.quantity || 1) * Number(item.unitPrice || 0) - Number(item.discountAmount || 0), 0),
  }));
  const subtotal = calculatedItems.reduce((sum, item) => sum + Number(item.quantity || 1) * Number(item.unitPrice || 0), 0);
  const discountAmount = calculatedItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const taxableAmount = Math.max(subtotal - discountAmount, 0);
  const tax = calculateTaxBreakdown({
    subtotal: taxableAmount,
    taxPercent,
    companyCountry,
    companyState,
    customerCountry,
    customerState,
  });
  const taxMode = tax.cgstAmount || tax.sgstAmount
    ? InvoiceTaxMode.CGST_SGST
    : tax.igstAmount
      ? InvoiceTaxMode.IGST
      : tax.taxVatAmount
        ? InvoiceTaxMode.TAX_VAT
        : InvoiceTaxMode.NONE;
  const total = taxableAmount + tax.totalTax;
  const paid = Math.min(Number(amountPaid || 0), total);
  const balanceDue = Math.max(total - paid, 0);
  const itemTaxRate = Number(taxPercent || 0);
  const itemsWithTax = calculatedItems.map((item, index) => {
    const taxShare = taxableAmount > 0 ? (item.taxableAmount / taxableAmount) * tax.totalTax : 0;
    return {
      ...item,
      taxRate: itemTaxRate,
      cgstRate: taxMode === 'CGST_SGST' ? itemTaxRate / 2 : 0,
      sgstRate: taxMode === 'CGST_SGST' ? itemTaxRate / 2 : 0,
      igstRate: taxMode === 'IGST' ? itemTaxRate : 0,
      taxAmount: taxShare,
      totalAmount: item.taxableAmount + taxShare,
      sortOrder: index,
    };
  });

  return { items: itemsWithTax, subtotal, discountAmount, taxableAmount, tax, taxMode, total, amountPaid: paid, balanceDue };
}

function statusFromPayment({
  currentStatus,
  amountPaid,
  total,
  dueDate,
}: {
  currentStatus?: InvoiceStatus;
  amountPaid: number;
  total: number;
  dueDate?: Date | null;
}) {
  if (currentStatus === InvoiceStatus.CANCELLED || currentStatus === InvoiceStatus.DRAFT) {
    return currentStatus;
  }

  const balanceDue = Math.max(total - amountPaid, 0);
  if (amountPaid >= total && total > 0) return InvoiceStatus.PAID;
  if (amountPaid > 0 && balanceDue > 0) return InvoiceStatus.PARTIALLY_PAID;
  if (dueDate && dueDate < new Date() && balanceDue > 0) return InvoiceStatus.OVERDUE;
  return currentStatus || InvoiceStatus.SENT;
}

async function nextInvoiceNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await prisma.invoice.findFirst({
    where: { companyId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const next = latest ? Number(latest.invoiceNumber.split('-').pop() || 0) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
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

async function ensureInvoiceRelations(auth: AuthPayload, contactId: string, dealId?: string | null) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId: auth.companyId },
  });
  if (!contact) return { error: 'Contact not found' as const };

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, ...getDealWhere(auth) },
      include: { project: { select: { id: true } } },
    });
    if (!deal) return { error: 'Deal not found' as const };
    if (deal.contactId !== contactId) return { error: 'Deal does not belong to selected contact' as const };
    const company = await prisma.company.findUnique({ where: { id: auth.companyId } });
    if (!company) return { error: 'Company not found' as const };
    return { contact, company, deal };
  }

  const company = await prisma.company.findUnique({ where: { id: auth.companyId } });
  if (!company) return { error: 'Company not found' as const };
  return { contact, company };
}

function invoiceWhereFromQuery(auth: AuthPayload, query: InvoiceListQuery): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { ...getInvoiceWhere(auth) };
  if (query.status) where.status = query.status;
  if (query.contactId) where.contactId = query.contactId;
  if (query.dealId) where.dealId = query.dealId;
  if (query.quotationId) where.quotationId = query.quotationId;
  if (query.dateFrom || query.dateTo) {
    where.issueDate = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }
  return where;
}

export async function listInvoices(auth: AuthPayload, query: InvoiceListQuery) {
  return prisma.invoice.findMany({
    where: invoiceWhereFromQuery(auth, query),
    include: invoiceInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInvoice(auth: AuthPayload, id: string) {
  return prisma.invoice.findFirst({
    where: { id, ...getInvoiceWhere(auth) },
    include: invoiceInclude,
  });
}

export async function createInvoice(auth: AuthPayload, payload: InvoiceCreatePayload) {
  const dealId = payload.dealId || null;
  const relations = await ensureInvoiceRelations(auth, payload.contactId, dealId);
  if ('error' in relations) return relations;

  const totals = calculateInvoiceTotals({
    items: payload.items,
    taxPercent: payload.taxPercent,
    amountPaid: payload.amountPaid,
    companyCountry: relations.company.country,
    companyState: relations.company.state,
    customerCountry: relations.contact.country,
    customerState: relations.contact.state,
  });
  const issueDate = dateOrUndefined(payload.issueDate) || new Date();
  const dueDate = dateOrUndefined(payload.dueDate);
  const status = statusFromPayment({
    currentStatus: payload.status,
    amountPaid: totals.amountPaid,
    total: totals.total,
    dueDate,
  });
  const projectId = 'deal' in relations && relations.deal ? relations.deal.project?.id : undefined;

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(auth.companyId),
        contactId: payload.contactId,
        dealId,
        projectId,
        companyId: auth.companyId,
        createdById: auth.userId,
        status,
        currency: 'INR',
        issueDate,
        dueDate,
        paymentTerms: payload.paymentTerms || 'On approval',
        notes: payload.notes,
        terms: payload.terms,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxPercent: payload.taxPercent,
        taxMode: totals.taxMode,
        gstRegistrationStatus: relations.company.gstin ? 'REGISTERED' : 'UNREGISTERED',
        cgstAmount: totals.tax.cgstAmount,
        sgstAmount: totals.tax.sgstAmount,
        igstAmount: totals.tax.igstAmount,
        taxVatAmount: totals.tax.taxVatAmount,
        taxAmount: totals.tax.totalTax,
        total: totals.total,
        totalAmount: totals.total,
        amountPaid: totals.amountPaid,
        balanceDue: totals.balanceDue,
        amountDue: totals.balanceDue,
        billingSnapshot: {
          name: relations.company.name,
          gstin: relations.company.gstin,
          country: relations.company.country,
          state: relations.company.state,
          addressLine1: relations.company.addressLine1,
          addressLine2: relations.company.addressLine2,
          city: relations.company.city,
          postalCode: relations.company.postalCode || relations.company.pincode,
          email: relations.company.email,
          phone: relations.company.phone,
        },
        customerSnapshot: {
          name:
            relations.contact.contactType === 'COMPANY'
              ? relations.contact.companyName || relations.contact.contactPersonName || relations.contact.firstName
              : `${relations.contact.firstName} ${relations.contact.lastName || ''}`.trim(),
          gstin: relations.contact.gstin,
          taxId: relations.contact.taxId,
          country: relations.contact.country,
          state: relations.contact.state,
          addressLine1: relations.contact.addressLine1,
          addressLine2: relations.contact.addressLine2,
          city: relations.contact.city,
          postalCode: relations.contact.postalCode || relations.contact.pincode,
          email: relations.contact.email,
          phone: relations.contact.phoneNumber,
        },
        items: { create: totals.items },
      },
      include: invoiceInclude,
    });

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.INVOICE_CREATED,
        contactId: invoice.contactId,
        dealId: invoice.dealId,
        userId: auth.userId,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      },
      tx,
    );

    return invoice;
  });
}

export async function createInvoiceFromQuotation(auth: AuthPayload, quotationId: string) {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, companyId: auth.companyId },
    include: {
      contact: true,
      company: true,
      deal: { include: { project: { select: { id: true } } } },
      items: true,
      invoices: { select: { id: true, invoiceNumber: true } },
    },
  });

  if (!quotation) return { error: 'Quotation not found' as const };
  if (quotation.status !== 'ACCEPTED') return { error: 'Mark quotation as accepted before creating invoice' as const };
  if (quotation.invoices.length) return { error: 'Invoice already exists for this quotation' as const, invoice: quotation.invoices[0] };

  const items = quotation.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: moneyNumber(item.unitPrice),
  }));
  const totals = calculateInvoiceTotals({
    items,
    taxPercent: moneyNumber(quotation.gstPercent),
    companyCountry: quotation.company.country,
    companyState: quotation.company.state,
    customerCountry: quotation.contact.country,
    customerState: quotation.contact.state,
  });

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: await nextInvoiceNumber(auth.companyId),
        quotationId: quotation.id,
        contactId: quotation.contactId,
        dealId: quotation.dealId,
        projectId: quotation.deal?.project?.id,
        companyId: auth.companyId,
        createdById: auth.userId,
        status: InvoiceStatus.DRAFT,
        currency: 'INR',
        paymentTerms: quotation.paymentTerms || 'On approval',
        terms: quotation.terms,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        taxPercent: quotation.gstPercent,
        taxMode: totals.taxMode,
        gstRegistrationStatus: quotation.company.gstin ? 'REGISTERED' : 'UNREGISTERED',
        cgstAmount: totals.tax.cgstAmount,
        sgstAmount: totals.tax.sgstAmount,
        igstAmount: totals.tax.igstAmount,
        taxVatAmount: totals.tax.taxVatAmount,
        taxAmount: totals.tax.totalTax,
        total: totals.total,
        totalAmount: totals.total,
        amountPaid: 0,
        balanceDue: totals.total,
        amountDue: totals.total,
        billingSnapshot: {
          name: quotation.company.name,
          gstin: quotation.company.gstin,
          country: quotation.company.country,
          state: quotation.company.state,
          addressLine1: quotation.company.addressLine1,
          addressLine2: quotation.company.addressLine2,
          city: quotation.company.city,
          postalCode: quotation.company.postalCode || quotation.company.pincode,
          email: quotation.company.email,
          phone: quotation.company.phone,
        },
        customerSnapshot: {
          name:
            quotation.contact.contactType === 'COMPANY'
              ? quotation.contact.companyName || quotation.contact.contactPersonName || quotation.contact.firstName
              : `${quotation.contact.firstName} ${quotation.contact.lastName || ''}`.trim(),
          gstin: quotation.contact.gstin,
          taxId: quotation.contact.taxId,
          country: quotation.contact.country,
          state: quotation.contact.state,
          addressLine1: quotation.contact.addressLine1,
          addressLine2: quotation.contact.addressLine2,
          city: quotation.contact.city,
          postalCode: quotation.contact.postalCode || quotation.contact.pincode,
          email: quotation.contact.email,
          phone: quotation.contact.phoneNumber,
        },
        items: { create: totals.items },
      },
      include: invoiceInclude,
    });

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.INVOICE_CREATED,
        contactId: invoice.contactId,
        dealId: invoice.dealId,
        userId: auth.userId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          quotationId: quotation.id,
          quoteNumber: quotation.quoteNumber,
        },
      },
      tx,
    );

    return invoice;
  });
}

export async function updateInvoice(auth: AuthPayload, id: string, payload: InvoiceUpdatePayload) {
  const existing = await prisma.invoice.findFirst({ where: { id, ...getInvoiceWhere(auth) } });
  if (!existing) return null;

  const dueDate = payload.dueDate === undefined ? existing.dueDate : dateOrUndefined(payload.dueDate);
  const amountPaid = payload.amountPaid === undefined ? moneyNumber(existing.amountPaid) : payload.amountPaid;
  const status = payload.status
    ? statusFromPayment({ currentStatus: payload.status as InvoiceStatus, amountPaid, total: moneyNumber(existing.total), dueDate })
    : statusFromPayment({ currentStatus: existing.status, amountPaid, total: moneyNumber(existing.total), dueDate });
  const balanceDue = Math.max(moneyNumber(existing.total) - amountPaid, 0);

  return prisma.invoice.update({
    where: { id: existing.id },
    data: {
      status,
      issueDate: dateOrUndefined(payload.issueDate),
      dueDate,
      paymentTerms: payload.paymentTerms,
      notes: payload.notes,
      terms: payload.terms,
      amountPaid,
      balanceDue,
      amountDue: balanceDue,
    },
    include: invoiceInclude,
  });
}

export async function updateInvoicePayment(
  auth: AuthPayload,
  id: string,
  payload: z.infer<typeof invoicePaymentSchema>,
) {
  const existing = await prisma.invoice.findFirst({ where: { id, ...getInvoiceWhere(auth) } });
  if (!existing) return null;
  if (existing.status === InvoiceStatus.CANCELLED) return { error: 'Cancelled invoices cannot receive payments' as const };

  const currentPaid = moneyNumber(existing.amountPaid);
  const amountReceived = Number(payload.amountReceived || 0);
  const currentBalance = moneyNumber(existing.balanceDue);
  if (amountReceived <= 0) return { error: 'Amount received must be greater than zero' as const };
  if (amountReceived > currentBalance) return { error: 'Amount received cannot exceed balance due' as const };

  const paid = Math.min(currentPaid + amountReceived, moneyNumber(existing.total));
  const balanceDue = Math.max(moneyNumber(existing.total) - paid, 0);
  const status = statusFromPayment({
    currentStatus: existing.status === InvoiceStatus.DRAFT ? InvoiceStatus.SENT : existing.status,
    amountPaid: paid,
    total: moneyNumber(existing.total),
    dueDate: existing.dueDate,
  });

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        companyId: auth.companyId,
        invoiceId: existing.id,
        projectId: existing.projectId,
        contactId: existing.contactId,
        amount: amountReceived,
        currency: existing.currency || 'INR',
        method: PaymentMethod.MANUAL,
        status: PaymentStatus.SUCCESS,
        paidAt: payload.paymentDate ? new Date(payload.paymentDate) : new Date(),
        notes: payload.notes,
        recordedById: auth.userId,
      },
    });

    const receipt = await tx.receipt.create({
      data: {
        companyId: auth.companyId,
        invoiceId: existing.id,
        paymentId: payment.id,
        projectId: existing.projectId,
        receiptNumber: await nextReceiptNumber(auth.companyId),
        amount: amountReceived,
        currency: existing.currency || 'INR',
        metadata: { paymentDate: payload.paymentDate, notes: payload.notes },
      },
    });

    const invoice = await tx.invoice.update({
      where: { id: existing.id },
      data: { amountPaid: paid, balanceDue, amountDue: balanceDue, status },
      include: invoiceInclude,
    });

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.INVOICE_PAYMENT_RECORDED,
        contactId: invoice.contactId,
        dealId: invoice.dealId,
        userId: auth.userId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          amountReceived,
          amountPaid: paid,
          balanceDue,
          paymentDate: payload.paymentDate,
          notes: payload.notes,
        },
      },
      tx,
    );

    if (
      status === InvoiceStatus.PAID ||
      status === InvoiceStatus.PARTIALLY_PAID ||
      status === InvoiceStatus.OVERDUE
    ) {
      await createActivityLog(
        {
          companyId: auth.companyId,
          eventType:
            status === InvoiceStatus.PAID
              ? ACTIVITY_TYPES.INVOICE_PAID
              : status === InvoiceStatus.PARTIALLY_PAID
                ? ACTIVITY_TYPES.INVOICE_PARTIALLY_PAID
                : ACTIVITY_TYPES.INVOICE_OVERDUE,
          contactId: invoice.contactId,
          dealId: invoice.dealId,
          userId: auth.userId,
          metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, balanceDue },
        },
        tx,
      );
    }

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.RECEIPT_CREATED,
        contactId: invoice.contactId,
        dealId: invoice.dealId,
        projectId: invoice.projectId,
        userId: auth.userId,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          amountReceived,
        },
      },
      tx,
    );

    return invoice;
  });
}

export async function setInvoiceStatus(auth: AuthPayload, id: string, status: InvoiceStatus) {
  const existing = await prisma.invoice.findFirst({ where: { id, ...getInvoiceWhere(auth) } });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({
      where: { id: existing.id },
      data: {
        status,
        amountPaid: status === InvoiceStatus.PAID ? existing.total : existing.amountPaid,
        balanceDue: status === InvoiceStatus.PAID ? 0 : existing.balanceDue,
        amountDue: status === InvoiceStatus.PAID ? 0 : existing.balanceDue,
        sentAt: status === InvoiceStatus.SENT ? new Date() : undefined,
        voidedAt: status === InvoiceStatus.CANCELLED ? new Date() : undefined,
      },
      include: invoiceInclude,
    });

    const eventType =
      status === InvoiceStatus.PAID
        ? ACTIVITY_TYPES.INVOICE_PAID
        : status === InvoiceStatus.CANCELLED
          ? ACTIVITY_TYPES.INVOICE_CANCELLED
          : status === InvoiceStatus.SENT
            ? ACTIVITY_TYPES.INVOICE_SENT
            : ACTIVITY_TYPES.INVOICE_CREATED;

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType,
        contactId: invoice.contactId,
        dealId: invoice.dealId,
        userId: auth.userId,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
      },
      tx,
    );

    return invoice;
  });
}

export async function cancelInvoice(auth: AuthPayload, id: string) {
  return setInvoiceStatus(auth, id, InvoiceStatus.CANCELLED);
}
