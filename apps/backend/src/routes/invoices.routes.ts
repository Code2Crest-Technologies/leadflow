import { InvoiceStatus } from '@prisma/client';
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import {
  cancelInvoice,
  createInvoice,
  createInvoiceFromQuotation,
  getInvoice,
  invoiceCreateSchema,
  invoiceListQuerySchema,
  invoicePaymentSchema,
  invoiceUpdateSchema,
  listInvoices,
  setInvoiceStatus,
  updateInvoice,
  updateInvoicePayment,
} from '../services/invoice.service.js';
import { generateInvoicePdfHtml } from '../services/invoicePdfHtml.service.js';

const router = Router();

router.use(requireAuth);

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
  }
  return res.status(500).json({ success: false, error: fallback });
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = invoiceListQuerySchema.parse(req.query);
    const data = await listInvoices(req.auth!, query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to fetch invoices');
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = invoiceCreateSchema.parse(req.body);
    const data = await createInvoice(req.auth!, payload);
    if ('error' in data) return res.status(404).json({ success: false, error: data.error });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to create invoice');
  }
});

router.post('/from-quotation/:quotationId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await createInvoiceFromQuotation(req.auth!, req.params.quotationId);
    if ('error' in data) {
      return res.status(data.error.includes('already') ? 409 : 400).json({ success: false, error: data.error, data: data.invoice });
    }
    res.status(201).json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to convert quotation to invoice' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getInvoice(req.auth!, req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = invoiceUpdateSchema.parse(req.body);
    const data = await updateInvoice(req.auth!, req.params.id, payload);
    if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to update invoice');
  }
});

router.patch('/:id/payment', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = invoicePaymentSchema.parse(req.body);
    const data = await updateInvoicePayment(req.auth!, req.params.id, payload);
    if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if ('error' in data) return res.status(400).json({ success: false, error: data.error });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'Failed to update payment');
  }
});

router.post('/:id/mark-sent', async (req: AuthenticatedRequest, res: Response) => {
  const data = await setInvoiceStatus(req.auth!, req.params.id, InvoiceStatus.SENT);
  if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
  res.json({ success: true, data });
});

router.post('/:id/mark-paid', async (req: AuthenticatedRequest, res: Response) => {
  const data = await setInvoiceStatus(req.auth!, req.params.id, InvoiceStatus.PAID);
  if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
  res.json({ success: true, data });
});

router.post('/:id/mark-cancelled', async (req: AuthenticatedRequest, res: Response) => {
  const data = await cancelInvoice(req.auth!, req.params.id);
  if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
  res.json({ success: true, data });
});

router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthenticatedRequest, res: Response) => {
  const data = await cancelInvoice(req.auth!, req.params.id);
  if (!data) return res.status(404).json({ success: false, error: 'Invoice not found' });
  res.json({ success: true, data });
});

router.get('/:id/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await getInvoice(req.auth!, req.params.id);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    const buffer = await generateInvoicePdfHtml(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Invoice PDF generation failed:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
});

export default router;
