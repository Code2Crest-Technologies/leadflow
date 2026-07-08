// src/controllers/webhookController.ts

import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import WhatsAppService from '../services/whatsappService.js';
import { prisma } from '../config/database.js';

export class WebhookController {
  /**
   * Verify webhook - responds to WhatsApp's verification request
   * WhatsApp sends: GET /?hub.mode=subscribe&hub.challenge=XXXX&hub.verify_token=YYYY
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      // Verify the request is from WhatsApp
      const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

      if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
          logger.info('Webhook verified successfully');
          // Respond with the challenge to confirm webhook
          res.status(200).send(challenge);
        } else {
          logger.warn('Webhook verification failed - invalid token');
          res.sendStatus(403);
        }
      } else {
        logger.warn('Webhook verification request missing parameters');
        res.sendStatus(400);
      }
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      res.status(500).json({ error: 'Webhook verification failed' });
    }
  }

  /**
   * Handle incoming webhook events from WhatsApp
   * Processes messages, status updates, and other events
   */
  async handleWebhookEvent(req: Request, res: Response): Promise<void> {
    try {
      // Respond immediately to WhatsApp
      res.status(200).json({ received: true });

      const body = req.body;
      logger.info('Webhook event received', { object: body.object });

      // Validate event structure
      if (body.object !== 'whatsapp_business_account') {
        logger.warn('Invalid webhook object type', { object: body.object });
        return;
      }

      // Process each entry in the webhook event
      for (const entry of body.entry || []) {
        const phoneNumberId = entry.changes?.[0]?.value?.metadata?.phone_number_id;

        if (!phoneNumberId) {
          logger.warn('Webhook event missing phone number ID');
          continue;
        }

        // Find company by WhatsApp phone number
        const company = await prisma.company.findUnique({
          where: { whatsappPhoneNumber: phoneNumberId },
        });

        if (!company) {
          logger.warn('Company not found for phone number', { phoneNumberId });
          continue;
        }

        if (!company.whatsappBusinessAccountId || !company.whatsappAccessToken) {
          logger.warn('WhatsApp credentials missing for webhook company', {
            companyId: company.id,
            phoneNumberId,
          });
          continue;
        }

        // Initialize WhatsApp service for this company
        const whatsappService = new WhatsAppService(
          phoneNumberId,
          company.whatsappBusinessAccountId,
          company.whatsappAccessToken
        );

        // Process the webhook event
        await whatsappService.processWebhookEvent(body, company.id);

        logger.info('Webhook event processed', { companyId: company.id });
      }
    } catch (error) {
      logger.error('Error handling webhook event:', error);
      // Don't re-respond to WhatsApp - we already sent success response
    }
  }
}

export const webhookController = new WebhookController();
