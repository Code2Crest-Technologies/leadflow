// src/services/whatsappService.ts

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { INotificationService } from './notificationService';

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  text?: string;
  type: string;
  media?: {
    id: string;
    type: string;
    url?: string;
  };
}

export interface WhatsAppTemplateVar {
  type: 'text';
  text: string;
}

export interface SendMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: string;
  [key: string]: any;
}

interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
}

class WhatsAppService {
  private client: AxiosInstance;
  private config: WhatsAppConfig;
  private baseUrl = 'https://graph.instagram.com/v18.0';
  private notificationService?: INotificationService;

  constructor(
    phoneNumberId: string,
    businessAccountId: string,
    accessToken: string,
    notificationService?: INotificationService
  ) {
    this.config = {
      phoneNumberId,
      businessAccountId,
      accessToken,
    };

    this.notificationService = notificationService;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('WhatsApp API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Send a simple text message
   */
  async sendTextMessage(
    toPhoneNumber: string,
    message: string,
    companyId: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const payload: SendMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber.replace(/\D/g, ''), // Remove non-digits
        type: 'text',
        text: {
          body: message,
        },
      };

      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        payload
      );

      logger.info(`Message sent to ${toPhoneNumber}`, {
        messageId: response.data.messages[0].id,
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
      };
    } catch (error) {
      logger.error(`Failed to send message to ${toPhoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Send a templated message with variables
   */
  async sendTemplateMessage(
    toPhoneNumber: string,
    templateName: string,
    languageCode: string = 'en',
    variables?: string[],
    companyId?: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const payload: SendMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          ...(variables && variables.length > 0 && {
            parameters: {
              body: {
                parameters: variables.map((v) => ({ type: 'text', text: v })),
              },
            },
          }),
        },
      };

      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        payload
      );

      logger.info(`Template message sent to ${toPhoneNumber}`, {
        messageId: response.data.messages[0].id,
        template: templateName,
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
      };
    } catch (error) {
      logger.error(`Failed to send template message to ${toPhoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Send a media message (image, document, etc.)
   */
  async sendMediaMessage(
    toPhoneNumber: string,
    mediaUrl: string,
    mediaType: 'image' | 'document' | 'video' | 'audio',
    caption?: string,
    companyId?: string
  ): Promise<{ messageId: string; status: string }> {
    try {
      const payload: SendMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhoneNumber.replace(/\D/g, ''),
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          ...(caption && mediaType === 'image' && { caption }),
        },
      };

      const response = await this.client.post(
        `/${this.config.phoneNumberId}/messages`,
        payload
      );

      logger.info(`Media message sent to ${toPhoneNumber}`, {
        messageId: response.data.messages[0].id,
        mediaType,
      });

      return {
        messageId: response.data.messages[0].id,
        status: 'sent',
      };
    } catch (error) {
      logger.error(`Failed to send media message to ${toPhoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Create a message template
   */
  async createMessageTemplate(
    name: string,
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
    content: string,
    language: string = 'en',
    variables?: string[],
    companyId?: string
  ): Promise<{ templateId: string; status: string }> {
    try {
      const payload = {
        name,
        category,
        allow_category_change: true,
        language,
        components: [
          {
            type: 'BODY',
            text: content,
            example: variables && {
              body_text: [variables],
            },
          },
        ],
      };

      const response = await this.client.post(
        `/${this.config.businessAccountId}/message_templates`,
        payload
      );

      logger.info('Message template created', {
        templateId: response.data.id,
        name,
      });

      return {
        templateId: response.data.id,
        status: 'PENDING_REVIEW',
      };
    } catch (error) {
      logger.error('Failed to create message template:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(
    eventData: any,
    companyId: string
  ): Promise<void> {
    try {
      const messages = eventData.entry?.[0]?.changes?.[0]?.value?.messages;
      const statuses = eventData.entry?.[0]?.changes?.[0]?.value?.statuses;

      if (messages) {
        for (const msg of messages) {
          await this.handleIncomingMessage(msg, companyId);
        }
      }

      if (statuses) {
        for (const status of statuses) {
          await this.handleMessageStatus(status, companyId);
        }
      }
    } catch (error) {
      logger.error('Failed to process webhook event:', error);
      throw error;
    }
  }

  /**
   * Handle incoming message and store in database
   */
  private async handleIncomingMessage(
    message: WhatsAppMessage,
    companyId: string
  ): Promise<void> {
    try {
      // Get or create contact
      let contact = await prisma.contact.findFirst({
        where: {
          companyId,
          whatsappContactId: message.from,
        },
      });

      if (!contact) {
        // Create new contact from incoming message
        contact = await prisma.contact.create({
          data: {
            companyId,
            phoneNumber: message.from,
            whatsappContactId: message.from,
            firstName: `Contact ${message.from}`,
            segment: 'PROSPECT',
          },
        });
      }

      // Get or create conversation
      let conversation = await prisma.conversation.findUnique({
        where: {
          companyId_contactId_channel: {
            companyId,
            contactId: contact.id,
            channel: 'WHATSAPP',
          },
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            companyId,
            contactId: contact.id,
            channel: 'WHATSAPP',
            status: 'OPEN',
          },
        });
      }

      // Store message
      const msg = await prisma.message.create({
        data: {
          companyId,
          contactId: contact.id,
          conversationId: conversation.id,
          direction: 'INBOUND',
          channel: 'WHATSAPP',
          messageType: message.type === 'text' ? 'TEXT' : 'IMAGE',
          content: message.text || '',
          whatsappMessageId: message.id,
          status: 'DELIVERED',
        },
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
        },
      });

      // Notify via WebSocket if service is available
      if (this.notificationService) {
        this.notificationService.broadcastToCompany(companyId, 'message:new', {
          message: msg,
          contact,
          conversation,
        });
      }

      logger.info('Incoming message processed', {
        contactId: contact.id,
        messageId: message.id,
      });
    } catch (error) {
      logger.error('Failed to handle incoming message:', error);
      throw error;
    }
  }

  /**
   * Handle message status updates from WhatsApp
   */
  private async handleMessageStatus(
    status: any,
    companyId: string
  ): Promise<void> {
    try {
      const msgStatus = status.status;
      const messageId = status.id;

      const message = await prisma.message.findFirst({
        where: {
          companyId,
          whatsappMessageId: messageId,
        },
      });

      if (message) {
        const updateData: any = { status: msgStatus.toUpperCase() };

        if (msgStatus === 'delivered') {
          updateData.deliveredAt = new Date();
        } else if (msgStatus === 'read') {
          updateData.readAt = new Date();
        } else if (msgStatus === 'failed') {
          updateData.failureReason = status.errors?.[0]?.message;
        }

        const updatedMsg = await prisma.message.update({
          where: { id: message.id },
          data: updateData,
        });

        // Notify via WebSocket
        if (this.notificationService) {
          this.notificationService.broadcastToCompany(companyId, 'message:status-update', {
            messageId: message.id,
            status: msgStatus,
          });
        }

        logger.info('Message status updated', {
          messageId,
          status: msgStatus,
        });
      }
    } catch (error) {
      logger.error('Failed to handle message status:', error);
      throw error;
    }
  }
}

export default WhatsAppService;
