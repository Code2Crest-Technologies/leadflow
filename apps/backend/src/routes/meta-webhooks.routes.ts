import { Router, Request, Response } from 'express';
import { validateWebhookSignature } from '../middleware/validation.js';
import { processMetaWebhook, verifyMetaWebhook, WhatsAppCloudError } from '../services/whatsappCloud.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/whatsapp', async (req: Request, res: Response) => {
  try {
    const challenge = await verifyMetaWebhook(req.query);
    res.status(200).send(challenge);
  } catch (error) {
    if (error instanceof WhatsAppCloudError) {
      return res.status(error.statusCode).json({ success: false, error: error.code });
    }
    res.status(500).json({ success: false, error: 'WEBHOOK_VERIFY_FAILED' });
  }
});

router.post('/whatsapp', validateWebhookSignature, async (req: Request, res: Response) => {
  try {
    await processMetaWebhook(req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Meta WhatsApp webhook failed', {
      error: error instanceof Error ? error.message : 'Unknown webhook error',
    });
    res.status(200).json({ received: true });
  }
});

export default router;
