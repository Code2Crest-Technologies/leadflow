import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import {
  ConversationChannel,
  ConversationStatus,
  MessageStatus,
  MessageType,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { createActivityLog } from './activityLog.service.js';
import type { AuthPayload } from '../types/index.js';
import { getDealWhere } from '../middleware/permissions.js';
import { logger } from '../utils/logger.js';
import { normalizePhoneToE164, whatsappRecipient } from '../utils/phone.js';

const PROVIDER = 'META_WHATSAPP';
const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

export const whatsappTextSchema = z.object({
  text: z.string().trim().min(1).max(4096),
});

export const whatsappTemplateSendSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string()).default({}),
});

export const conversationDealLinkSchema = z.object({
  dealId: z.string().min(1).nullable(),
});

export const communicationSettingsSchema = z.object({
  whatsappAssignmentStrategy: z.enum(['MANUAL', 'ROUND_ROBIN']).default('MANUAL'),
  newLeadAcknowledgement: z.boolean().default(false),
  onboardingLink: z.boolean().default(false),
  onboardingReminder: z.boolean().default(false),
  documentSent: z.boolean().default(false),
  invoiceSent: z.boolean().default(false),
  paymentReminders: z.boolean().default(false),
  paymentConfirmation: z.boolean().default(false),
  projectKickoff: z.boolean().default(false),
});

export type WhatsAppIntegrationConfig = {
  companyId: string;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string | null;
  graphVersion: string;
};

export class WhatsAppCloudError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = 'WHATSAPP_ERROR',
    public retryable = false,
  ) {
    super(message);
  }
}

function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || 'v20.0';
}

function envIntegration(): WhatsAppIntegrationConfig | null {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;

  return {
    companyId: '',
    accessToken,
    phoneNumberId,
    businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
    graphVersion: graphVersion(),
  };
}

function safeMetaError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string; code?: number; type?: string; error_subcode?: number } } | undefined;
    return {
      message: data?.error?.message || error.message,
      code: data?.error?.code ? String(data.error.code) : undefined,
      type: data?.error?.type,
      retryable: Boolean(error.response?.status && error.response.status >= 500),
    };
  }
  return { message: error instanceof Error ? error.message : 'WhatsApp provider error', retryable: false };
}

async function resolveIntegrationByPhoneNumberId(phoneNumberId: string) {
  const integration = await prisma.integration.findFirst({
    where: {
      type: PROVIDER,
      phoneNumberId,
      status: { in: ['CONNECTED', 'connected', 'PENDING'] },
    },
    include: { company: true },
  });

  if (integration) {
    const config = integration.config as Prisma.JsonObject | null;
    const token = typeof config?.accessToken === 'string' ? config.accessToken : process.env.META_WHATSAPP_ACCESS_TOKEN;
    return token
      ? {
          integration,
          config: {
            companyId: integration.companyId,
            accessToken: token,
            phoneNumberId,
            businessAccountId: integration.whatsappBusinessAccountId,
            graphVersion: graphVersion(),
          },
        }
      : null;
  }

  const env = envIntegration();
  if (!env || env.phoneNumberId !== phoneNumberId) return null;
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { whatsappBusinessAccountId: env.businessAccountId || undefined },
        { integrations: { some: { type: PROVIDER, phoneNumberId } } },
      ],
    },
  });
  if (!company) return null;
  return { integration: null, config: { ...env, companyId: company.id } };
}

async function resolveCompanyIntegration(companyId: string) {
  const integration = await prisma.integration.findFirst({
    where: { companyId, type: PROVIDER, status: { in: ['CONNECTED', 'connected', 'PENDING'] } },
  });
  const config = integration?.config as Prisma.JsonObject | null;
  const token = typeof config?.accessToken === 'string' ? config.accessToken : process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = integration?.phoneNumberId || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new WhatsAppCloudError('WhatsApp integration is not configured.', 409, 'WHATSAPP_NOT_CONFIGURED');
  }
  return {
    accessToken: token,
    phoneNumberId,
    businessAccountId: integration?.whatsappBusinessAccountId || process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
    companyId,
    graphVersion: graphVersion(),
  };
}

async function graphPost(config: WhatsAppIntegrationConfig, path: string, payload: Prisma.InputJsonObject) {
  try {
    const response = await axios.post(`https://graph.facebook.com/${config.graphVersion}${path}`, payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data as { messages?: Array<{ id: string }> };
  } catch (error) {
    const meta = safeMetaError(error as AxiosError);
    throw new WhatsAppCloudError(meta.message, meta.retryable ? 503 : 400, meta.code || 'WHATSAPP_PROVIDER_ERROR', meta.retryable);
  }
}

function extractMessageContent(message: Record<string, any>) {
  const type = String(message.type || 'unsupported').toLowerCase();
  if (type === 'text') return { content: String(message.text?.body || ''), messageType: MessageType.TEXT, metadata: {} };
  if (['image', 'document', 'audio', 'video'].includes(type)) {
    const media = message[type] || {};
    return {
      content: media.caption || media.filename || `[${type} message]`,
      messageType: type.toUpperCase() as MessageType,
      metadata: {
        providerMediaId: media.id,
        mimeType: media.mime_type,
        filename: media.filename,
        caption: media.caption,
      },
    };
  }
  if (type === 'location') {
    return { content: '[location shared]', messageType: MessageType.LOCATION, metadata: message.location || {} };
  }
  if (type === 'interactive') {
    const reply = message.interactive?.button_reply || message.interactive?.list_reply || {};
    return { content: reply.title || reply.id || '[interactive reply]', messageType: MessageType.INTERACTIVE, metadata: message.interactive || {} };
  }
  return { content: `[unsupported ${type} message]`, messageType: MessageType.UNSUPPORTED, metadata: message };
}

function contactNameFromWebhook(phone: string, contacts: Array<{ wa_id?: string; profile?: { name?: string } }>) {
  const found = contacts.find((item) => item.wa_id === phone);
  return found?.profile?.name || `WhatsApp ${phone}`;
}

async function getOrCreateContact(companyId: string, phone: string, displayName: string) {
  const normalized = normalizePhoneToE164(phone);
  const existing = await prisma.contact.findFirst({
    where: {
      companyId,
      OR: [{ phoneNormalized: normalized }, { phoneNumber: phone }, { whatsappContactId: phone }],
    },
  });
  if (existing) {
    if (!existing.phoneNormalized) {
      return prisma.contact.update({ where: { id: existing.id }, data: { phoneNormalized: normalized, whatsappContactId: phone } });
    }
    return existing;
  }

  return prisma.contact.create({
    data: {
      companyId,
      phoneNumber: normalized,
      phoneNormalized: normalized,
      whatsappContactId: phone,
      firstName: displayName,
      segment: 'LEAD',
      customFields: { source: 'WHATSAPP' },
      whatsappOptInStatus: 'UNKNOWN',
    },
  });
}

async function getOrCreateConversation(companyId: string, contactId: string) {
  const existing = await prisma.conversation.findUnique({
    where: {
      companyId_contactId_channel: {
        companyId,
        contactId,
        channel: ConversationChannel.WHATSAPP,
      },
    },
  });
  if (existing) return existing;

  const settings = await prisma.communicationSettings.findUnique({ where: { companyId } });
  const assignedToId = settings?.whatsappAssignmentStrategy === 'ROUND_ROBIN' ? await pickRoundRobinAssignee(companyId, settings.roundRobinCursorUserId) : null;
  const conversation = await prisma.conversation.create({
    data: {
      companyId,
      contactId,
      channel: ConversationChannel.WHATSAPP,
      assignedToId,
      status: assignedToId ? ConversationStatus.ASSIGNED : ConversationStatus.OPEN,
    },
  });

  await createActivityLog({
    companyId,
    eventType: ACTIVITY_TYPES.WHATSAPP_CONVERSATION_STARTED,
    contactId,
    conversationId: conversation.id,
    metadata: { assignedToId },
  });

  return conversation;
}

async function pickRoundRobinAssignee(companyId: string, cursorUserId?: string | null) {
  const users = await prisma.user.findMany({
    where: { companyId, status: 'ACTIVE', deletedAt: null, role: { in: ['AGENT', 'MANAGER'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!users.length) return null;
  const index = cursorUserId ? users.findIndex((user) => user.id === cursorUserId) : -1;
  const next = users[(index + 1) % users.length];
  await prisma.communicationSettings.upsert({
    where: { companyId },
    create: { companyId, whatsappAssignmentStrategy: 'ROUND_ROBIN', roundRobinCursorUserId: next.id },
    update: { roundRobinCursorUserId: next.id },
  });
  return next.id;
}

function statusToMessageStatus(status: string): MessageStatus {
  if (status === 'read') return MessageStatus.READ;
  if (status === 'delivered') return MessageStatus.DELIVERED;
  if (status === 'sent') return MessageStatus.SENT;
  if (status === 'failed') return MessageStatus.FAILED;
  return MessageStatus.PENDING;
}

function hasOpenServiceWindow(conversation: { serviceWindowEndsAt?: Date | null; lastInboundAt?: Date | null }) {
  return Boolean(conversation.serviceWindowEndsAt && conversation.serviceWindowEndsAt > new Date());
}

function renderTemplate(content: string, variables: Record<string, string>) {
  const missing = new Set<string>();
  const rendered = content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    if (!value) {
      missing.add(key);
      return `{{${key}}}`;
    }
    return value;
  });
  if (missing.size) {
    throw new WhatsAppCloudError(`Missing template variables: ${Array.from(missing).join(', ')}`, 400, 'TEMPLATE_VARIABLE_MISSING');
  }
  return rendered;
}

export async function verifyMetaWebhook(query: Record<string, unknown>) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && token && token === verifyToken) return String(challenge || '');
  throw new WhatsAppCloudError('Invalid webhook verification token', 403, 'WEBHOOK_VERIFY_FAILED');
}

export async function processMetaWebhook(payload: Record<string, any>) {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      const resolved = await resolveIntegrationByPhoneNumberId(phoneNumberId);
      if (!resolved) {
        logger.warn('WhatsApp webhook tenant not found', { phoneNumberId });
        continue;
      }

      if (resolved.integration) {
        await prisma.integration.update({
          where: { id: resolved.integration.id },
          data: { lastWebhookAt: new Date(), status: 'CONNECTED' },
        });
      }

      await processInboundMessages(resolved.config.companyId, value.messages || [], value.contacts || []);
      await processStatusUpdates(resolved.config.companyId, value.statuses || []);
    }
  }
}

async function processInboundMessages(companyId: string, messages: Array<Record<string, any>>, contacts: Array<{ wa_id?: string; profile?: { name?: string } }>) {
  for (const providerMessage of messages) {
    const providerMessageId = providerMessage.id;
    if (!providerMessageId) continue;
    const event = await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: PROVIDER, eventId: providerMessageId } },
      create: { companyId, provider: PROVIDER, eventId: providerMessageId, eventType: 'message', payload: providerMessage },
      update: {},
    });
    if (event.processedAt) continue;

    const phone = String(providerMessage.from || '');
    const displayName = contactNameFromWebhook(phone, contacts);
    const contact = await getOrCreateContact(companyId, phone, displayName);
    const conversation = await getOrCreateConversation(companyId, contact.id);
    const content = extractMessageContent(providerMessage);
    const inboundAt = providerMessage.timestamp ? new Date(Number(providerMessage.timestamp) * 1000) : new Date();
    const serviceWindowEndsAt = new Date(inboundAt.getTime() + 24 * 60 * 60 * 1000);

    const existingMessage = await prisma.message.findFirst({
      where: { companyId, OR: [{ providerMessageId }, { whatsappMessageId: providerMessageId }] },
    });
    if (!existingMessage) {
      await prisma.message.create({
        data: {
          companyId,
          contactId: contact.id,
          conversationId: conversation.id,
          direction: 'INBOUND',
          channel: ConversationChannel.WHATSAPP,
          messageType: content.messageType,
          content: content.content,
          providerMessageId,
          whatsappMessageId: providerMessageId,
          providerStatus: 'DELIVERED',
          status: MessageStatus.DELIVERED,
          metadata: content.metadata as Prisma.InputJsonValue,
          deliveredAt: inboundAt,
        },
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: inboundAt,
          lastInboundAt: inboundAt,
          serviceWindowEndsAt,
          unreadCount: { increment: 1 },
          messageCount: { increment: 1 },
          status: conversation.status === ConversationStatus.CLOSED ? ConversationStatus.OPEN : conversation.status,
        },
      });

      if (content.content.trim().toUpperCase() === 'STOP') {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { whatsappOptInStatus: 'OPTED_OUT', whatsappOptedOutAt: inboundAt, whatsappOptSource: 'WHATSAPP_REPLY' },
        });
        await createActivityLog({
          companyId,
          eventType: ACTIVITY_TYPES.WHATSAPP_CONTACT_OPTED_OUT,
          contactId: contact.id,
          conversationId: conversation.id,
          metadata: { providerMessageId },
        });
      }
    }

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  }
}

async function processStatusUpdates(companyId: string, statuses: Array<Record<string, any>>) {
  for (const providerStatus of statuses) {
    const providerMessageId = providerStatus.id;
    if (!providerMessageId) continue;
    const eventId = `${providerMessageId}:${providerStatus.status}:${providerStatus.timestamp || ''}`;
    const event = await prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: PROVIDER, eventId } },
      create: { companyId, provider: PROVIDER, eventId, eventType: 'status', payload: providerStatus },
      update: {},
    });
    if (event.processedAt) continue;

    const message = await prisma.message.findFirst({
      where: { companyId, OR: [{ providerMessageId }, { whatsappMessageId: providerMessageId }] },
    });
    if (message) {
      const nextStatus = statusToMessageStatus(String(providerStatus.status));
      const currentRank = STATUS_RANK[message.status] ?? 0;
      const nextRank = STATUS_RANK[nextStatus] ?? 0;
      if (nextRank >= currentRank || nextStatus === MessageStatus.FAILED) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            status: nextStatus,
            providerStatus: providerStatus.status,
            whatsappStatusId: providerStatus.id,
            sentAt: nextStatus === MessageStatus.SENT ? new Date() : undefined,
            deliveredAt: nextStatus === MessageStatus.DELIVERED ? new Date() : undefined,
            readAt: nextStatus === MessageStatus.READ ? new Date() : undefined,
            failedAt: nextStatus === MessageStatus.FAILED ? new Date() : undefined,
            failureCode: providerStatus.errors?.[0]?.code ? String(providerStatus.errors[0].code) : undefined,
            failureReason: providerStatus.errors?.[0]?.message,
            metadata: providerStatus as Prisma.InputJsonValue,
          },
        });
      }
    }

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  }
}

export async function sendWhatsAppText(auth: AuthPayload, conversationId: string, text: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId: auth.companyId },
    include: { contact: true },
  });
  if (!conversation) throw new WhatsAppCloudError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
  if (conversation.channel !== ConversationChannel.WHATSAPP) throw new WhatsAppCloudError('Conversation is not a WhatsApp thread', 400, 'INVALID_CHANNEL');
  if (!hasOpenServiceWindow(conversation)) {
    throw new WhatsAppCloudError('The 24-hour customer service window has closed. Send an approved template to restart the conversation.', 409, 'SERVICE_WINDOW_CLOSED');
  }
  if (conversation.contact.whatsappOptInStatus === 'OPTED_OUT') {
    throw new WhatsAppCloudError('Contact has opted out of WhatsApp automation.', 409, 'WHATSAPP_OPTED_OUT');
  }

  const config = await resolveCompanyIntegration(auth.companyId);
  const localMessage = await prisma.message.create({
    data: {
      companyId: auth.companyId,
      contactId: conversation.contactId,
      conversationId,
      senderId: auth.userId,
      direction: 'OUTBOUND',
      channel: ConversationChannel.WHATSAPP,
      messageType: MessageType.TEXT,
      content: text,
      status: MessageStatus.PENDING,
    },
  });

  try {
    const response = await graphPost(config, `/${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: whatsappRecipient(conversation.contact.phoneNormalized || conversation.contact.phoneNumber),
      type: 'text',
      text: { body: text },
    });
    const providerMessageId = response.messages?.[0]?.id;
    const message = await prisma.message.update({
      where: { id: localMessage.id },
      data: { status: MessageStatus.SENT, providerMessageId, whatsappMessageId: providerMessageId, providerStatus: 'sent', sentAt: new Date() },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), messageCount: { increment: 1 } } });
    await createActivityLog({
      companyId: auth.companyId,
      eventType: ACTIVITY_TYPES.WHATSAPP_MESSAGE_SENT,
      contactId: conversation.contactId,
      conversationId,
      userId: auth.userId,
      metadata: { messageId: message.id },
    });
    return message;
  } catch (error) {
    const safe = error instanceof WhatsAppCloudError ? error : new WhatsAppCloudError('WhatsApp message failed', 400);
    await prisma.message.update({
      where: { id: localMessage.id },
      data: { status: MessageStatus.FAILED, failedAt: new Date(), failureCode: safe.code, failureReason: safe.message },
    });
    await createActivityLog({
      companyId: auth.companyId,
      eventType: ACTIVITY_TYPES.WHATSAPP_MESSAGE_FAILED,
      contactId: conversation.contactId,
      conversationId,
      userId: auth.userId,
      metadata: { messageId: localMessage.id, code: safe.code, retryable: safe.retryable },
    });
    throw safe;
  }
}

export async function sendWhatsAppTemplate(auth: AuthPayload, conversationId: string, templateId: string, variables: Record<string, string>) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId: auth.companyId },
    include: { contact: true },
  });
  if (!conversation) throw new WhatsAppCloudError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
  if (conversation.contact.whatsappOptInStatus === 'OPTED_OUT') throw new WhatsAppCloudError('Contact has opted out of WhatsApp automation.', 409, 'WHATSAPP_OPTED_OUT');

  const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, companyId: auth.companyId, deletedAt: null } });
  if (!template) throw new WhatsAppCloudError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  if (template.status !== 'APPROVED') throw new WhatsAppCloudError('Only approved WhatsApp templates can be sent.', 409, 'TEMPLATE_NOT_APPROVED');

  const config = await resolveCompanyIntegration(auth.companyId);
  const renderedContent = renderTemplate(template.content, variables);
  const templateName = template.providerTemplateName || template.whatsappTemplateCode || template.name;
  const parameters = template.variables.map((variable) => ({
    type: 'text',
    text: variables[variable] || '',
  }));
  if (parameters.some((item) => !item.text)) {
    throw new WhatsAppCloudError('Missing template variables.', 400, 'TEMPLATE_VARIABLE_MISSING');
  }

  const localMessage = await prisma.message.create({
    data: {
      companyId: auth.companyId,
      contactId: conversation.contactId,
      conversationId,
      senderId: auth.userId,
      direction: 'OUTBOUND',
      channel: ConversationChannel.WHATSAPP,
      messageType: MessageType.TEMPLATE,
      content: renderedContent,
      templateId: template.id,
      templateName,
      status: MessageStatus.PENDING,
    },
  });

  try {
    const response = await graphPost(config, `/${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: whatsappRecipient(conversation.contact.phoneNormalized || conversation.contact.phoneNumber),
      type: 'template',
      template: {
        name: templateName,
        language: { code: template.language || 'en' },
        ...(parameters.length
          ? { components: [{ type: 'body', parameters }] }
          : {}),
      },
    });
    const providerMessageId = response.messages?.[0]?.id;
    const message = await prisma.message.update({
      where: { id: localMessage.id },
      data: { status: MessageStatus.SENT, providerMessageId, whatsappMessageId: providerMessageId, providerStatus: 'sent', sentAt: new Date() },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), messageCount: { increment: 1 } } });
    await createActivityLog({
      companyId: auth.companyId,
      eventType: ACTIVITY_TYPES.WHATSAPP_TEMPLATE_SENT,
      contactId: conversation.contactId,
      conversationId,
      userId: auth.userId,
      metadata: { messageId: message.id, templateId: template.id, templateName },
    });
    return message;
  } catch (error) {
    const safe = error instanceof WhatsAppCloudError ? error : new WhatsAppCloudError('WhatsApp template failed', 400);
    await prisma.message.update({
      where: { id: localMessage.id },
      data: { status: MessageStatus.FAILED, failedAt: new Date(), failureCode: safe.code, failureReason: safe.message },
    });
    throw safe;
  }
}

export async function linkConversationDeal(auth: AuthPayload, conversationId: string, dealId: string | null) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, companyId: auth.companyId } });
  if (!conversation) return null;
  if (dealId) {
    const deal = await prisma.deal.findFirst({ where: { id: dealId, contactId: conversation.contactId, ...getDealWhere(auth) } });
    if (!deal) throw new WhatsAppCloudError('Deal not found for this contact.', 404, 'DEAL_NOT_FOUND');
  }
  return prisma.conversation.update({ where: { id: conversation.id }, data: { dealId }, include: { contact: true, deal: true } });
}

export async function getCommunicationSettings(auth: AuthPayload) {
  return prisma.communicationSettings.upsert({
    where: { companyId: auth.companyId },
    create: { companyId: auth.companyId },
    update: {},
  });
}

export async function updateCommunicationSettings(auth: AuthPayload, payload: z.infer<typeof communicationSettingsSchema>) {
  return prisma.communicationSettings.upsert({
    where: { companyId: auth.companyId },
    create: { companyId: auth.companyId, ...payload },
    update: payload,
  });
}

export async function testWhatsAppConnection(auth: AuthPayload) {
  const config = await resolveCompanyIntegration(auth.companyId);
  try {
    const response = await axios.get(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      params: { fields: 'id,display_phone_number,verified_name' },
    });
    return { connected: true, phoneNumberId: config.phoneNumberId, details: response.data };
  } catch (error) {
    const safe = safeMetaError(error);
    return { connected: false, error: safe.message };
  }
}
