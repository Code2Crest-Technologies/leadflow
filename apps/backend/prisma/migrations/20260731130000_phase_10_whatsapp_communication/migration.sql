-- Phase 10: WhatsApp Cloud API and communication automation foundation.

ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';

ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'LOCATION';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'INTERACTIVE';
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'UNSUPPORTED';

ALTER TABLE "Contact"
  ADD COLUMN "phoneNormalized" TEXT,
  ADD COLUMN "whatsappOptInStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "whatsappOptedInAt" TIMESTAMP(3),
  ADD COLUMN "whatsappOptedOutAt" TIMESTAMP(3),
  ADD COLUMN "whatsappOptSource" TEXT;

CREATE UNIQUE INDEX "Contact_companyId_phoneNormalized_key" ON "Contact"("companyId", "phoneNormalized");

ALTER TABLE "Conversation"
  ADD COLUMN "dealId" TEXT,
  ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastInboundAt" TIMESTAMP(3),
  ADD COLUMN "serviceWindowEndsAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "lastAutoReplyAt" TIMESTAMP(3);

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Conversation_dealId_idx" ON "Conversation"("dealId");
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

ALTER TABLE "Message"
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "templateName" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT;

CREATE INDEX "Message_providerMessageId_idx" ON "Message"("providerMessageId");

ALTER TABLE "MessageTemplate"
  ADD COLUMN "providerTemplateName" TEXT,
  ADD COLUMN "header" TEXT,
  ADD COLUMN "footer" TEXT,
  ADD COLUMN "providerMetadata" JSONB;

ALTER TABLE "Integration"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "whatsappBusinessAccountId" TEXT,
  ADD COLUMN "phoneNumberId" TEXT,
  ADD COLUMN "displayPhoneNumber" TEXT,
  ADD COLUMN "businessDisplayName" TEXT,
  ADD COLUMN "webhookConfiguredAt" TIMESTAMP(3),
  ADD COLUMN "connectedAt" TIMESTAMP(3),
  ADD COLUMN "disconnectedAt" TIMESTAMP(3),
  ADD COLUMN "lastWebhookAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

CREATE UNIQUE INDEX "Integration_type_phoneNumberId_key" ON "Integration"("type", "phoneNumberId");
CREATE INDEX "Integration_phoneNumberId_idx" ON "Integration"("phoneNumberId");
CREATE INDEX "Integration_whatsappBusinessAccountId_idx" ON "Integration"("whatsappBusinessAccountId");

CREATE TABLE "CommunicationSettings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "whatsappAssignmentStrategy" TEXT NOT NULL DEFAULT 'MANUAL',
  "roundRobinCursorUserId" TEXT,
  "newLeadAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
  "onboardingLink" BOOLEAN NOT NULL DEFAULT false,
  "onboardingReminder" BOOLEAN NOT NULL DEFAULT false,
  "documentSent" BOOLEAN NOT NULL DEFAULT false,
  "invoiceSent" BOOLEAN NOT NULL DEFAULT false,
  "paymentReminders" BOOLEAN NOT NULL DEFAULT false,
  "paymentConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "projectKickoff" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationSettings_companyId_key" ON "CommunicationSettings"("companyId");

CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
CREATE INDEX "WebhookEvent_companyId_idx" ON "WebhookEvent"("companyId");
CREATE INDEX "WebhookEvent_provider_idx" ON "WebhookEvent"("provider");
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

ALTER TABLE "CommunicationSettings"
  ADD CONSTRAINT "CommunicationSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookEvent"
  ADD CONSTRAINT "WebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
