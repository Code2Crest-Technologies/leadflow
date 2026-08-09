import { Router } from 'express';
import { createRateLimiter } from '../middleware/security.js';
import {
  acceptPublicDocumentController,
  downloadPublicDocumentPdfController,
  getPublicDocumentController,
  rejectPublicDocumentController,
} from '../controllers/document.controller.js';

const router = Router();

router.use(createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60 }));

router.get('/:token', getPublicDocumentController);
router.get('/:token/pdf', downloadPublicDocumentPdfController);
router.post('/:token/accept', createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 }), acceptPublicDocumentController);
router.post('/:token/reject', createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 }), rejectPublicDocumentController);

export default router;
