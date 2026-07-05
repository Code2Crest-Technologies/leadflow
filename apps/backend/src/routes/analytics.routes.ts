import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { getAnalyticsData } from '../services/analytics.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('ADMIN', 'MANAGER'));

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getAnalyticsData(req.auth!) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

router.get('/sources', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, data: await getAnalyticsData(req.auth!) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

export default router;
