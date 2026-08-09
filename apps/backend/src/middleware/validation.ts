// src/middleware/validation.ts

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * Validate webhook signature from WhatsApp
 * WhatsApp signs all webhook events with HMAC SHA256
 */
export const validateWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;

    if (!signature) {
      logger.warn('Missing webhook signature');
      res.status(403).json({ error: 'Missing signature' });
      return;
    }

    const appSecret = process.env.META_WHATSAPP_APP_SECRET || process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      logger.warn('Webhook app secret is not configured');
      res.status(503).json({ error: 'Webhook signature validation unavailable' });
      return;
    }
    const payload = (req as any).rawBody || JSON.stringify(req.body);

    // Generate HMAC
    const hash = crypto
      .createHmac('sha256', appSecret!)
      .update(payload)
      .digest('hex');

    const expectedSignature = `sha256=${hash}`;

    // Compare signatures using timing-safe comparison
    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      logger.warn('Invalid webhook signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error validating webhook signature:', error);
    res.status(500).json({ error: 'Signature validation failed' });
  }
};

/**
 * Middleware to capture raw body for webhook signature verification
 */
export const captureRawBody = (req: Request, res: Response, next: NextFunction) => {
  next();
};
