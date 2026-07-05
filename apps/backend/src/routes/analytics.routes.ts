import { Router, Response } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/permissions';
import { getAnalyticsData } from '../services/analytics.service';

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
