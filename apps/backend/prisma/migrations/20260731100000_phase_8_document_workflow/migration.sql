CREATE TYPE "DocumentType" AS ENUM (
  'PROPOSAL',
  'STATEMENT_OF_WORK',
  'SERVICE_AGREEMENT',
  'NDA',
  'MAINTENANCE_AGREEMENT',
  'SAAS_SUBSCRIPTION_AGREEMENT',
  'CUSTOM'
);

CREATE TYPE "DocumentStatus" AS ENUM (
  'DRAFT',
  'READY',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
  'CANCELLED'
);

CREATE TABLE "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DocumentType" NOT NULL,
  "description" TEXT,
  "content" TEXT NOT NULL,
  "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dealId" TEXT,
  "projectId" TEXT,
  "contactId" TEXT NOT NULL,
  "templateId" TEXT,
  "type" "DocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdById" TEXT,
  "expiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "renderedContent" TEXT NOT NULL,
  "sourceSnapshot" JSONB,
  "pdfPath" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentPublicToken" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "lastViewedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentPublicToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAcceptance" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "contactId" TEXT,
  "acceptedByName" TEXT NOT NULL,
  "acceptedByEmail" TEXT NOT NULL,
  "designation" TEXT,
  "acceptanceText" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentAcceptance_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivityLog" ADD COLUMN "documentId" TEXT;

CREATE INDEX "DocumentTemplate_companyId_idx" ON "DocumentTemplate"("companyId");
CREATE INDEX "DocumentTemplate_type_idx" ON "DocumentTemplate"("type");
CREATE INDEX "DocumentTemplate_isActive_idx" ON "DocumentTemplate"("isActive");

CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");
CREATE INDEX "Document_dealId_idx" ON "Document"("dealId");
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE INDEX "Document_contactId_idx" ON "Document"("contactId");
CREATE INDEX "Document_type_idx" ON "Document"("type");
CREATE INDEX "Document_status_idx" ON "Document"("status");

CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNumber_key" ON "DocumentVersion"("documentId", "versionNumber");
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

CREATE UNIQUE INDEX "DocumentPublicToken_tokenHash_key" ON "DocumentPublicToken"("tokenHash");
CREATE INDEX "DocumentPublicToken_documentId_idx" ON "DocumentPublicToken"("documentId");
CREATE INDEX "DocumentPublicToken_versionId_idx" ON "DocumentPublicToken"("versionId");
CREATE INDEX "DocumentPublicToken_expiresAt_idx" ON "DocumentPublicToken"("expiresAt");
CREATE INDEX "DocumentPublicToken_invalidatedAt_idx" ON "DocumentPublicToken"("invalidatedAt");

CREATE UNIQUE INDEX "DocumentAcceptance_documentId_versionId_key" ON "DocumentAcceptance"("documentId", "versionId");
CREATE INDEX "DocumentAcceptance_documentId_idx" ON "DocumentAcceptance"("documentId");
CREATE INDEX "DocumentAcceptance_versionId_idx" ON "DocumentAcceptance"("versionId");

CREATE INDEX "ActivityLog_documentId_idx" ON "ActivityLog"("documentId");

ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentPublicToken" ADD CONSTRAINT "DocumentPublicToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPublicToken" ADD CONSTRAINT "DocumentPublicToken_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAcceptance" ADD CONSTRAINT "DocumentAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAcceptance" ADD CONSTRAINT "DocumentAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAcceptance" ADD CONSTRAINT "DocumentAcceptance_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
