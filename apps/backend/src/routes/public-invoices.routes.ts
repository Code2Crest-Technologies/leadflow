import { Router, Response } from 'express';
import { createRateLimiter } from '../middleware/security.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getPublicInvoice } from '../services/billing.service.js';
import { generateInvoicePdfHtml } from '../services/invoicePdfHtml.service.js';

const router = Router();

router.use(createRateLimiter({ windowMs: 10 * 60 * 1000, max: 80 }));

router.get('/:token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await getPublicInvoice(req.params.token);
    if (!data) return res.status(404).json({ success: false, error: 'Invoice link is invalid or expired' });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch public invoice' });
  }
});

router.get('/:token/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = await getPublicInvoice(req.params.token);
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice link is invalid or expired' });
    const buffer = await generateInvoicePdfHtml(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(buffer);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
});

export default router;
