-- Code2Crest client onboarding automation reminder history

CREATE TABLE "ClientOnboardingReminder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT,
    "publicFormTokenId" TEXT,
    "reminderDay" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ClientOnboardingReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientOnboardingReminder_companyId_dealId_reminderDay_key" ON "ClientOnboardingReminder"("companyId", "dealId", "reminderDay");
CREATE INDEX "ClientOnboardingReminder_companyId_idx" ON "ClientOnboardingReminder"("companyId");
CREATE INDEX "ClientOnboardingReminder_dealId_idx" ON "ClientOnboardingReminder"("dealId");
CREATE INDEX "ClientOnboardingReminder_sentAt_idx" ON "ClientOnboardingReminder"("sentAt");

ALTER TABLE "ClientOnboardingReminder" ADD CONSTRAINT "ClientOnboardingReminder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientOnboardingReminder" ADD CONSTRAINT "ClientOnboardingReminder_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
