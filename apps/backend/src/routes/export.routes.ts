import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import {
  exportAnalyticsInvoicesCsv,
  exportAnalyticsMonthlySalesCsv,
  exportAnalyticsSourcesCsv,
  exportAnalyticsSummaryCsv,
  exportContactsCsv,
  exportDealsCsv,
  exportFileName,
  exportInvoicesCsv,
  exportQuotationsCsv,
} from '../services/export.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('ADMIN', 'MANAGER'));

function sendCsv(res: Response, entity: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(entity)}"`);
  res.send(csv);
}

router.get('/contacts.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'contacts', await exportContactsCsv(req.auth!, req.query));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export contacts' });
  }
});

router.get('/deals.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'deals', await exportDealsCsv(req.auth!, req.query));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export deals' });
  }
});

router.get('/quotations.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'quotations', await exportQuotationsCsv(req.auth!, req.query));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export quotations' });
  }
});

router.get('/invoices.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'invoices', await exportInvoicesCsv(req.auth!, req.query));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export invoices' });
  }
});

router.get('/analytics-summary.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'analytics-summary', await exportAnalyticsSummaryCsv(req.auth!));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export analytics summary' });
  }
});

router.get('/analytics-sources.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'analytics-sources', await exportAnalyticsSourcesCsv(req.auth!));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export analytics sources' });
  }
});

router.get('/analytics-monthly-sales.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'analytics-monthly-sales', await exportAnalyticsMonthlySalesCsv(req.auth!));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export monthly sales' });
  }
});

router.get('/analytics-invoices.csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    sendCsv(res, 'analytics-invoices', await exportAnalyticsInvoicesCsv(req.auth!));
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export invoice analytics' });
  }
});

export default router;
