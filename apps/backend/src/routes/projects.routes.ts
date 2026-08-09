import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  assignProjectController,
  getDealKickoffReadinessController,
  createProjectFromDealController,
  getProjectController,
  listProjectsController,
  projectHandoffController,
  removeProjectMemberController,
  transitionProjectStatusController,
  updateProjectController,
  upsertProjectMemberController,
} from '../controllers/project.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', listProjectsController);
router.get('/deals/:dealId/readiness', getDealKickoffReadinessController);
router.post('/deals/:dealId', createProjectFromDealController);
router.get('/:id', getProjectController);
router.patch('/:id', updateProjectController);
router.patch('/:id/assignment', assignProjectController);
router.post('/:id/members', upsertProjectMemberController);
router.delete('/:id/members/:memberId', removeProjectMemberController);
router.patch('/:id/status', transitionProjectStatusController);
router.get('/:id/handoff', projectHandoffController);

export default router;
