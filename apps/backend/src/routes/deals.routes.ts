import { Router } from 'express';
import {
  createDealController,
  getDealController,
  getDealTimelineController,
  listDealsController,
  updateDealController,
  updateDealStageController,
} from '../controllers/deal.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', listDealsController);
router.post('/', createDealController);
router.get('/:id', getDealController);
router.put('/:id', updateDealController);
router.get('/:id/timeline', getDealTimelineController);
router.patch('/:id/stage', updateDealStageController);

export default router;
