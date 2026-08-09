CREATE TYPE "ProjectStatus" AS ENUM (
  'DRAFT',
  'READY_FOR_KICKOFF',
  'ACTIVE',
  'ON_HOLD',
  'CLIENT_REVIEW',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ProjectMemberRole" AS ENUM (
  'PROJECT_MANAGER',
  'DEVELOPER',
  'DESIGNER',
  'QA',
  'SALES',
  'SUPPORT',
  'OTHER'
);

CREATE TYPE "ProjectDeliverableStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'CLIENT_REVIEW',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ProjectMilestoneStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'COMPLETED',
  'SKIPPED'
);

CREATE TYPE "ProjectRequirementType" AS ENUM (
  'ASSET',
  'ACCESS',
  'CONTENT',
  'TECHNICAL',
  'OTHER'
);

CREATE TYPE "ProjectRequirementStatus" AS ENUM (
  'PENDING',
  'REQUESTED',
  'RECEIVED',
  'NOT_REQUIRED'
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serviceType" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "ownerId" TEXT,
  "projectManagerId" TEXT,
  "startDate" TIMESTAMP(3),
  "targetDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "brief" TEXT,
  "briefData" JSONB,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ProjectMemberRole" NOT NULL DEFAULT 'OTHER',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDeliverable" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectDeliverableStatus" NOT NULL DEFAULT 'PENDING',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDeliverable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "targetDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRequirement" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "type" "ProjectRequirementType" NOT NULL,
  "label" TEXT NOT NULL,
  "status" "ProjectRequirementStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRequirement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "projectId" TEXT;

CREATE UNIQUE INDEX "Project_dealId_key" ON "Project"("dealId");
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");
CREATE INDEX "Project_contactId_idx" ON "Project"("contactId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

CREATE INDEX "ProjectDeliverable_projectId_idx" ON "ProjectDeliverable"("projectId");
CREATE INDEX "ProjectDeliverable_status_idx" ON "ProjectDeliverable"("status");

CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");
CREATE INDEX "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");

CREATE INDEX "ProjectRequirement_projectId_idx" ON "ProjectRequirement"("projectId");
CREATE INDEX "ProjectRequirement_type_idx" ON "ProjectRequirement"("type");
CREATE INDEX "ProjectRequirement_status_idx" ON "ProjectRequirement"("status");

CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "ActivityLog_projectId_idx" ON "ActivityLog"("projectId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectDeliverable" ADD CONSTRAINT "ProjectDeliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
