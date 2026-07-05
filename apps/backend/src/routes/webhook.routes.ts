// src/routes/webhook.routes.ts

import { Router, Request, Response } from 'express';
import { webhookController } from '../controllers/webhookController.js';
import { validateWebhookSignature } from '../middleware/validation.js';

const router = Router();

/**
 * GET /webhook/whatsapp
 * WhatsApp sends a GET request to verify the webhook URL
 */
router.get('/whatsapp', webhookController.verifyWebhook);

/**
 * POST /webhook/whatsapp
 * WhatsApp sends messages and status updates to this endpoint
 */
router.post(
  '/whatsapp',
  validateWebhookSignature,
  webhookController.handleWebhookEvent
);

export default router;
