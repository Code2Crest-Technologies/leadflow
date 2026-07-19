import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { FormField } from '@prisma/client';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { slugify } from '../services/forms.service.js';
import {
  FormSubmissionValidationError,
  validateSubmissionValues,
} from '../services/formValidation.service.js';

function field(input: Partial<FormField> & Pick<FormField, 'key' | 'label' | 'type'>): FormField {
  return {
    id: input.id || input.key,
    formId: input.formId || 'form_1',
    key: input.key,
    label: input.label,
    type: input.type,
    placeholder: input.placeholder ?? null,
    helpText: input.helpText ?? null,
    required: input.required ?? false,
    order: input.order ?? 0,
    options: input.options ?? null,
    validation: input.validation ?? null,
    createdAt: input.createdAt || new Date(),
    updatedAt: input.updatedAt || new Date(),
  };
}

describe('forms foundation', () => {
  it('generates production-safe slugs', () => {
    expect(slugify('Client Onboarding Form')).toBe('client-onboarding-form');
    expect(slugify(' Site Survey / Phase 1 ')).toBe('site-survey-phase-1');
  });

  it('validates required fields and select options server-side', () => {
    const fields = [
      field({ key: 'name', label: 'Name', type: 'TEXT', required: true }),
      field({
        key: 'service',
        label: 'Service',
        type: 'SELECT',
        required: true,
        options: [{ label: 'Website', value: 'website' }],
      }),
    ];

    expect(() => validateSubmissionValues(fields, { name: 'Barath', service: 'website' })).not.toThrow();
    expect(() => validateSubmissionValues(fields, { name: '', service: 'mobile' })).toThrow(FormSubmissionValidationError);
  });

  it('rejects unknown public submission fields', () => {
    const fields = [field({ key: 'email', label: 'Email', type: 'EMAIL', required: true })];
    expect(() => validateSubmissionValues(fields, { email: 'hello@example.com', companyId: 'wrong-company' })).toThrow(
      FormSubmissionValidationError,
    );
  });

  it('declares required forms activity types', () => {
    expect(ACTIVITY_TYPES.FORM_CREATED).toBe('FORM_CREATED');
    expect(ACTIVITY_TYPES.FORM_LINK_CREATED).toBe('FORM_LINK_CREATED');
    expect(ACTIVITY_TYPES.FORM_SUBMISSION_COMPLETED).toBe('FORM_SUBMISSION_COMPLETED');
  });

  it('keeps public token security in the migration and routes', () => {
    const migration = readFileSync('prisma/migrations/20260719090000_forms_foundation/migration.sql', 'utf8');
    const publicRoutes = readFileSync('src/routes/public-forms.routes.ts', 'utf8');
    const formsService = readFileSync('src/services/forms.service.ts', 'utf8');

    expect(migration).toContain('"tokenHash" TEXT NOT NULL');
    expect(migration).toContain('CREATE UNIQUE INDEX "PublicFormToken_tokenHash_key"');
    expect(formsService).toContain("crypto.createHash('sha256')");
    expect(publicRoutes).toContain("router.post(\n  '/:token/submit'");
  });
});
