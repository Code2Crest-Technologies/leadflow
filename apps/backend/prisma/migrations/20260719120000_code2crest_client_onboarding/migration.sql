-- Code2Crest client onboarding workflow

CREATE TYPE "DealOnboardingStatus" AS ENUM (
  'NOT_STARTED',
  'LINK_CREATED',
  'SENT',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'COMPLETED'
);

ALTER TABLE "Deal"
  ADD COLUMN "onboardingStatus" "DealOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED';

ALTER TABLE "Form"
  ADD COLUMN "systemKey" TEXT;

CREATE UNIQUE INDEX "Form_companyId_systemKey_key" ON "Form"("companyId", "systemKey");
CREATE INDEX "Deal_onboardingStatus_idx" ON "Deal"("onboardingStatus");
