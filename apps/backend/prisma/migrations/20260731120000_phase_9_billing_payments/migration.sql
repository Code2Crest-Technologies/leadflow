-- Phase 9: Billing, GST invoicing, payment tracking, public invoice links, and receipts.

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'VIEWED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'VOID';

CREATE TYPE "GstRegistrationStatus" AS ENUM ('REGISTERED', 'UNREGISTERED', 'COMPOSITION', 'OVERSEAS');
CREATE TYPE "InvoiceTaxMode" AS ENUM ('NONE', 'CGST_SGST', 'IGST', 'TAX_VAT');
CREATE TYPE "PaymentMilestoneStatus" AS ENUM ('PENDING', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'WAIVED');
CREATE TYPE "PaymentMethod" AS ENUM ('MANUAL', 'BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'CARD', 'RAZORPAY');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED');

ALTER TABLE "Invoice"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxMode" "InvoiceTaxMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "gstRegistrationStatus" "GstRegistrationStatus",
  ADD COLUMN "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "amountDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "billingSnapshot" JSONB,
  ADD COLUMN "customerSnapshot" JSONB,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "viewedAt" TIMESTAMP(3),
  ADD COLUMN "voidedAt" TIMESTAMP(3);

UPDATE "Invoice"
SET
  "taxableAmount" = "subtotal",
  "taxAmount" = "cgstAmount" + "sgstAmount" + "igstAmount" + "taxVatAmount",
  "totalAmount" = "total",
  "amountDue" = "balanceDue",
  "taxMode" = CASE
    WHEN "cgstAmount" > 0 OR "sgstAmount" > 0 THEN 'CGST_SGST'::"InvoiceTaxMode"
    WHEN "igstAmount" > 0 THEN 'IGST'::"InvoiceTaxMode"
    WHEN "taxVatAmount" > 0 THEN 'TAX_VAT'::"InvoiceTaxMode"
    ELSE 'NONE'::"InvoiceTaxMode"
  END;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

ALTER TABLE "InvoiceItem"
  ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "cgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "sgstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "igstRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "InvoiceItem"
SET
  "taxableAmount" = "total",
  "totalAmount" = "total";

CREATE TABLE "BillingProfile" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "gstin" TEXT,
  "gstRegistrationStatus" "GstRegistrationStatus" NOT NULL DEFAULT 'UNREGISTERED',
  "country" TEXT DEFAULT 'India',
  "state" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "phoneCountryCode" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "bankDetails" TEXT,
  "defaultPaymentTerms" TEXT DEFAULT 'On approval',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoicePublicToken" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "lastViewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "InvoicePublicToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentMilestone" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT,
  "invoiceId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "percentage" DECIMAL(65,30),
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "status" "PaymentMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "projectId" TEXT,
  "contactId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "method" "PaymentMethod" NOT NULL DEFAULT 'MANUAL',
  "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS',
  "provider" TEXT,
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "providerSignature" TEXT,
  "referenceNumber" TEXT,
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Receipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "projectId" TEXT,
  "receiptNumber" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdfDownloadedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentReminderLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "reminderKey" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'MANUAL',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "PaymentReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoicePublicToken_tokenHash_key" ON "InvoicePublicToken"("tokenHash");
CREATE INDEX "InvoicePublicToken_invoiceId_idx" ON "InvoicePublicToken"("invoiceId");
CREATE INDEX "InvoicePublicToken_expiresAt_idx" ON "InvoicePublicToken"("expiresAt");

CREATE INDEX "BillingProfile_companyId_idx" ON "BillingProfile"("companyId");
CREATE INDEX "BillingProfile_isDefault_idx" ON "BillingProfile"("isDefault");

CREATE INDEX "PaymentMilestone_companyId_idx" ON "PaymentMilestone"("companyId");
CREATE INDEX "PaymentMilestone_projectId_idx" ON "PaymentMilestone"("projectId");
CREATE INDEX "PaymentMilestone_invoiceId_idx" ON "PaymentMilestone"("invoiceId");
CREATE INDEX "PaymentMilestone_status_idx" ON "PaymentMilestone"("status");

CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX "Payment_projectId_idx" ON "Payment"("projectId");
CREATE INDEX "Payment_contactId_idx" ON "Payment"("contactId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

CREATE UNIQUE INDEX "Receipt_companyId_receiptNumber_key" ON "Receipt"("companyId", "receiptNumber");
CREATE INDEX "Receipt_companyId_idx" ON "Receipt"("companyId");
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");
CREATE INDEX "Receipt_paymentId_idx" ON "Receipt"("paymentId");
CREATE INDEX "Receipt_projectId_idx" ON "Receipt"("projectId");

CREATE UNIQUE INDEX "PaymentReminderLog_invoiceId_reminderKey_channel_key" ON "PaymentReminderLog"("invoiceId", "reminderKey", "channel");
CREATE INDEX "PaymentReminderLog_companyId_idx" ON "PaymentReminderLog"("companyId");
CREATE INDEX "PaymentReminderLog_invoiceId_idx" ON "PaymentReminderLog"("invoiceId");

ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePublicToken" ADD CONSTRAINT "InvoicePublicToken_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMilestone" ADD CONSTRAINT "PaymentMilestone_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentReminderLog" ADD CONSTRAINT "PaymentReminderLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentReminderLog" ADD CONSTRAINT "PaymentReminderLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
