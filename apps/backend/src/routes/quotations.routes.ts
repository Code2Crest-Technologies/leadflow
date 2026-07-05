import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getDealWhere, getQuotationWhere } from '../middleware/permissions.js';
import { createActivityLog } from '../services/activityLog.service.js';
import { generateQuotationPdfHtml } from '../services/quotationPdfHtml.service.js';

const router = Router();

const quotationItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative(),
});

const quotationSchema = z.object({
  contactId: z.string().min(1),
  dealId: z.string().optional().or(z.literal('')),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  paymentTerms: z.string().trim().optional().default('On approval'),
  terms: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']).default('DRAFT'),
  items: z.array(quotationItemSchema).min(1),
});

const quotationContactSelect = {
  firstName: true,
  lastName: true,
  contactType: true,
  companyName: true,
  contactPersonName: true,
  phoneCountryCode: true,
  phoneNumber: true,
  email: true,
  country: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  pincode: true,
  postalCode: true,
  gstin: true,
  taxId: true,
};

async function nextQuoteNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const count = await prisma.quotation.count({
    where: { companyId, quoteNumber: { startsWith: prefix } },
  });

  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

function calculateQuotation(payload: z.infer<typeof quotationSchema>) {
  const items = payload.items.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const gstAmount = subtotal * (payload.gstPercent / 100);
  const total = subtotal + gstAmount;

  return { items, subtotal, gstAmount, total };
}

async function ensureQuotationRelations(
  auth: NonNullable<AuthenticatedRequest['auth']>,
  contactId: string,
  dealId: string | null,
) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId: auth.companyId },
  });
  if (!contact) return 'Contact not found';

  if (dealId) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, ...getDealWhere(auth) } });
    if (!deal) return 'Deal not found';
    if (deal.contactId !== contactId) return 'Deal does not belong to selected contact';
  }

  return null;
}

router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.quotation.findMany({
      where: getQuotationWhere(req.auth!),
      include: {
        contact: { select: quotationContactSelect },
        deal: { select: { title: true, stage: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch quotations' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = quotationSchema.parse(req.body);
    const companyId = req.auth!.companyId;
    const dealId = payload.dealId || null;
    const relationError = await ensureQuotationRelations(req.auth!, payload.contactId, dealId);
    if (relationError) return res.status(404).json({ success: false, error: relationError });

    const { items, subtotal, gstAmount, total } = calculateQuotation(payload);

    const data = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.create({
        data: {
          quoteNumber: await nextQuoteNumber(companyId),
          contactId: payload.contactId,
          dealId,
          companyId,
          status: payload.status,
          gstPercent: payload.gstPercent,
          paymentTerms: payload.paymentTerms || 'On approval',
          terms: payload.terms,
          subtotal,
          gstAmount,
          total,
          items: { create: items },
        },
        include: {
          contact: { select: quotationContactSelect },
          deal: { select: { title: true, stage: true } },
          items: true,
        },
      });

      if (dealId) {
        await createActivityLog(
          {
            companyId,
            eventType: ACTIVITY_TYPES.QUOTATION_CREATED,
            contactId: payload.contactId,
            dealId,
            userId: req.auth!.userId,
            metadata: { quotationId: quotation.id, quoteNumber: quotation.quoteNumber, total: Number(quotation.total) },
          },
          tx,
        );

        if (payload.status === 'SENT') {
          await createActivityLog(
            {
              companyId,
              eventType: ACTIVITY_TYPES.QUOTATION_SENT,
              contactId: payload.contactId,
              dealId,
              userId: req.auth!.userId,
              metadata: { quotationId: quotation.id, quoteNumber: quotation.quoteNumber },
            },
            tx,
          );
        }
      }

      return quotation;
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create quotation' });
  }
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = quotationSchema.parse(req.body);
    const companyId = req.auth!.companyId;
    const dealId = payload.dealId || null;
    const existing = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...getQuotationWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    const relationError = await ensureQuotationRelations(req.auth!, payload.contactId, dealId);
    if (relationError) return res.status(404).json({ success: false, error: relationError });

    const { items, subtotal, gstAmount, total } = calculateQuotation(payload);

    const data = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: existing.id } });

      return tx.quotation.update({
        where: { id: existing.id },
        data: {
          contactId: payload.contactId,
          dealId,
          status: payload.status,
          gstPercent: payload.gstPercent,
          paymentTerms: payload.paymentTerms || 'On approval',
          terms: payload.terms,
          subtotal,
          gstAmount,
          total,
          items: { create: items },
        },
        include: {
          contact: { select: quotationContactSelect },
          deal: { select: { title: true, stage: true } },
          items: true,
        },
      });
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update quotation' });
  }
});

router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = z
      .object({ status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']) })
      .parse(req.body);
    const existing = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...getQuotationWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    const data = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.update({
        where: { id: existing.id },
        data: { status },
      });

      if (status === 'SENT' && existing.status !== 'SENT' && existing.dealId) {
        await createActivityLog(
          {
            companyId: req.auth!.companyId,
            eventType: ACTIVITY_TYPES.QUOTATION_SENT,
            contactId: existing.contactId,
            dealId: existing.dealId,
            userId: req.auth!.userId,
            metadata: { quotationId: existing.id, quoteNumber: existing.quoteNumber },
          },
          tx,
        );
      }

      return quotation;
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update quotation' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...getQuotationWhere(req.auth!) },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Quotation not found' });

    await prisma.quotation.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Quotation deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete quotation' });
  }
});

router.get('/:id/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...getQuotationWhere(req.auth!) },
      include: {
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
        contact: { select: quotationContactSelect },
        deal: { select: { title: true } },
        items: true,
      },
    });

    if (!quotation) {
      return res.status(404).json({ success: false, error: 'Quotation not found' });
    }

    const buffer = await generateQuotationPdfHtml(quotation);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quotation.quoteNumber}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Quotation PDF generation failed:', error);
    res.status(500).json({ success: false, error: 'Failed to generate quotation PDF' });
  }
});

export default router;
