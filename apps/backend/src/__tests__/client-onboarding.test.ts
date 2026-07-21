import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import {
  CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY,
  code2crestOnboardingFields,
  getCode2CrestOnboardingVisibleFieldKeys,
} from '../services/clientOnboarding.service.js';

describe('Code2Crest client onboarding foundation', () => {
  it('uses a stable Code2Crest-only template key and required fields', () => {
    expect(CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY).toBe('CODE2CREST_CLIENT_ONBOARDING');
    expect(code2crestOnboardingFields.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        'primaryContactName',
        'companyName',
        'businessEmail',
        'phone',
        'projectName',
        'serviceType',
        'projectSummary',
        'primaryBusinessGoal',
        'informationConfirmed',
        'onboardingConsent',
      ]),
    );
  });

  it('declares onboarding activity types for the deal timeline', () => {
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_CREATED).toBe('CLIENT_ONBOARDING_LINK_CREATED');
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_SENT).toBe('CLIENT_ONBOARDING_SENT');
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_SUBMITTED).toBe('CLIENT_ONBOARDING_SUBMITTED');
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_REVIEW_STARTED).toBe('CLIENT_ONBOARDING_REVIEW_STARTED');
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_COMPLETED).toBe('CLIENT_ONBOARDING_COMPLETED');
    expect(ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED).toBe('CLIENT_ONBOARDING_LINK_REGENERATED');
  });

  it('adds durable schema fields through a production migration', () => {
    const migration = readFileSync('prisma/migrations/20260719120000_code2crest_client_onboarding/migration.sql', 'utf8');

    expect(migration).toContain('CREATE TYPE "DealOnboardingStatus"');
    expect(migration).toContain('ADD COLUMN "onboardingStatus"');
    expect(migration).toContain('ADD COLUMN "systemKey" TEXT');
    expect(migration).toContain('CREATE UNIQUE INDEX "Form_companyId_systemKey_key"');
  });

  it('keeps tenant resolution and token associations server-side', () => {
    const service = readFileSync('src/services/clientOnboarding.service.ts', 'utf8');

    expect(service).toContain('CODE2CREST_LEADFLOW_COMPANY_ID');
    expect(service).toContain('DEAL_MUST_BE_WON');
    expect(service).toContain('contactId: deal.contactId');
    expect(service).toContain('dealId: deal.id');
    expect(service).toContain('isActive: false');
  });

  it('shows only service-specific onboarding fields', () => {
    const websiteKeys = getCode2CrestOnboardingVisibleFieldKeys({ serviceType: 'Website Development' });
    const appKeys = getCode2CrestOnboardingVisibleFieldKeys({ serviceType: 'Mobile App Development' });
    const maintenanceKeys = getCode2CrestOnboardingVisibleFieldKeys({ serviceType: 'Maintenance & Support' });

    expect(websiteKeys.has('estimatedPages')).toBe(true);
    expect(websiteKeys.has('coreFeatures')).toBe(false);
    expect(appKeys.has('coreFeatures')).toBe(true);
    expect(appKeys.has('estimatedPages')).toBe(false);
    expect(maintenanceKeys.has('issueSummary')).toBe(true);
    expect(maintenanceKeys.has('estimatedPages')).toBe(false);
  });
});
