import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import {
  cancelDocumentController,
  cloneDocumentTemplateController,
  createDocumentController,
  createDocumentPublicLinkController,
  createDocumentRevisionController,
  createDocumentTemplateController,
  downloadDocumentPdfController,
  getDocumentController,
  listDocumentTemplatesController,
  listDocumentsController,
  markDocumentReadyController,
  sendDocumentController,
  updateDocumentController,
  updateDocumentTemplateController,
} from '../controllers/document.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/templates', listDocumentTemplatesController);
router.post('/templates', requireRole('ADMIN'), createDocumentTemplateController);
router.put('/templates/:id', requireRole('ADMIN'), updateDocumentTemplateController);
router.post('/templates/:id/clone', requireRole('ADMIN'), cloneDocumentTemplateController);

router.get('/', listDocumentsController);
router.post('/', createDocumentController);
router.get('/:id', getDocumentController);
router.patch('/:id', updateDocumentController);
router.post('/:id/revisions', createDocumentRevisionController);
router.post('/:id/ready', markDocumentReadyController);
router.post('/:id/send', sendDocumentController);
router.post('/:id/link', createDocumentPublicLinkController);
router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER'), cancelDocumentController);
router.get('/:id/pdf', downloadDocumentPdfController);

export default router;
