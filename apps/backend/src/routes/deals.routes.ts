import { Router } from 'express';
import {
  createDealController,
  getDealController,
  getDealTimelineController,
  listDealsController,
  markClientOnboardingCompletedController,
  markClientOnboardingSentController,
  markClientOnboardingUnderReviewController,
  regenerateClientOnboardingController,
  startClientOnboardingController,
  updateDealController,
  updateDealStageController,
} from '../controllers/deal.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/', listDealsController);
router.post('/', createDealController);
router.get('/:id', getDealController);
router.put('/:id', updateDealController);
router.get('/:id/timeline', getDealTimelineController);
router.patch('/:id/stage', updateDealStageController);
router.post('/:id/onboarding/start', requirePermission('forms.publish'), startClientOnboardingController);
router.post('/:id/onboarding/regenerate', requirePermission('forms.publish'), regenerateClientOnboardingController);
router.post('/:id/onboarding/mark-sent', requirePermission('forms.publish'), markClientOnboardingSentController);
router.post('/:id/onboarding/under-review', requirePermission('forms.update'), markClientOnboardingUnderReviewController);
router.post('/:id/onboarding/complete', requirePermission('forms.update'), markClientOnboardingCompletedController);

export default router;
