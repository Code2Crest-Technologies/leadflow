import { Router } from 'express';
import {
  copyableClientOnboardingLinkController,
  createDealController,
  downloadClientOnboardingPdfController,
  getDealController,
  getDealTimelineController,
  getClientOnboardingMetricsController,
  listDealsController,
  markClientOnboardingCompletedController,
  markClientOnboardingSentController,
  markClientOnboardingUnderReviewController,
  regenerateClientOnboardingController,
  sendClientOnboardingEmailController,
  shareClientOnboardingWhatsAppController,
  startClientOnboardingController,
  updateDealController,
  updateDealStageController,
} from '../controllers/deal.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { createProjectFromDealController, getDealKickoffReadinessController } from '../controllers/project.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listDealsController);
router.post('/', createDealController);
router.get('/onboarding/metrics', requirePermission('forms.submissions.read'), getClientOnboardingMetricsController);
router.get('/:id', getDealController);
router.get('/:dealId/project-readiness', getDealKickoffReadinessController);
router.post('/:dealId/project', createProjectFromDealController);
router.put('/:id', updateDealController);
router.get('/:id/timeline', getDealTimelineController);
router.patch('/:id/stage', updateDealStageController);
router.post('/:id/onboarding/start', requirePermission('forms.publish'), startClientOnboardingController);
router.post('/:id/onboarding/regenerate', requirePermission('forms.publish'), regenerateClientOnboardingController);
router.post('/:id/onboarding/copy-link', requirePermission('forms.publish'), copyableClientOnboardingLinkController);
router.post('/:id/onboarding/send-email', requirePermission('forms.publish'), sendClientOnboardingEmailController);
router.post('/:id/onboarding/share-whatsapp', requirePermission('forms.publish'), shareClientOnboardingWhatsAppController);
router.post('/:id/onboarding/mark-sent', requirePermission('forms.publish'), markClientOnboardingSentController);
router.post('/:id/onboarding/under-review', requirePermission('forms.update'), markClientOnboardingUnderReviewController);
router.post('/:id/onboarding/complete', requirePermission('forms.update'), markClientOnboardingCompletedController);
router.get('/:id/onboarding/pdf', requirePermission('forms.submissions.read'), downloadClientOnboardingPdfController);

export default router;
