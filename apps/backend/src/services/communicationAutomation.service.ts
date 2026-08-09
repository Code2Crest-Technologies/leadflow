import type { AuthPayload } from '../types/index.js';
import { prisma } from '../config/database.js';
import { sendWhatsAppTemplate } from './whatsappCloud.service.js';

export type CommunicationAutomationTrigger =
  | 'ONBOARDING_LINK_READY'
  | 'ONBOARDING_REMINDER_DUE'
  | 'DOCUMENT_READY'
  | 'DOCUMENT_ACCEPTED'
  | 'INVOICE_SENT'
  | 'PAYMENT_DUE'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'PROJECT_STARTED';

export type CommunicationAutomationAction =
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP_TEMPLATE'
  | 'CREATE_NOTIFICATION'
  | 'CREATE_TASK';

type AutomationPayload = {
  conversationId?: string;
  templateId?: string;
  variables?: Record<string, string>;
};

const settingByTrigger: Partial<Record<CommunicationAutomationTrigger, keyof Awaited<ReturnType<typeof prisma.communicationSettings.upsert>>>> = {
  ONBOARDING_LINK_READY: 'onboardingLink',
  ONBOARDING_REMINDER_DUE: 'onboardingReminder',
  DOCUMENT_READY: 'documentSent',
  INVOICE_SENT: 'invoiceSent',
  PAYMENT_DUE: 'paymentReminders',
  PAYMENT_OVERDUE: 'paymentReminders',
  PAYMENT_RECEIVED: 'paymentConfirmation',
  PROJECT_STARTED: 'projectKickoff',
};

export async function runCommunicationAutomation(
  auth: AuthPayload,
  trigger: CommunicationAutomationTrigger,
  payload: AutomationPayload,
) {
  const settings = await prisma.communicationSettings.upsert({
    where: { companyId: auth.companyId },
    create: { companyId: auth.companyId },
    update: {},
  });
  const settingKey = settingByTrigger[trigger];
  if (!settingKey || settings[settingKey] !== true) {
    return { skipped: true, reason: 'AUTOMATION_DISABLED' as const };
  }

  if (!payload.conversationId || !payload.templateId) {
    return { skipped: true, reason: 'WHATSAPP_TEMPLATE_NOT_CONFIGURED' as const };
  }

  const message = await sendWhatsAppTemplate(auth, payload.conversationId, payload.templateId, payload.variables || {});
  return { skipped: false, action: 'SEND_WHATSAPP_TEMPLATE' as CommunicationAutomationAction, message };
}

export async function sendOperationalWhatsAppTemplate(
  auth: AuthPayload,
  conversationId: string,
  templateId: string,
  variables: Record<string, string>,
) {
  return sendWhatsAppTemplate(auth, conversationId, templateId, variables);
}
