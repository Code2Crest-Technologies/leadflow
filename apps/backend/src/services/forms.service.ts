import crypto from 'crypto';
import type { FormFieldType, FormPurpose, FormStatus, FormSubmissionStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import type { AuthPayload } from '../types/index.js';
import { createActivityLog } from './activityLog.service.js';
import {
  getCode2CrestOnboardingVisibleFieldKeys,
  isCode2CrestClientOnboarding,
  updateDealOnboardingFromPublicView,
  updateDealOnboardingFromSubmission,
} from './clientOnboarding.service.js';
import {
  FormSubmissionValidationError,
  getSubmittedBy,
  type SubmissionValueMap,
  validateSubmissionValues,
} from './formValidation.service.js';
import { notifyFormSubmission } from './notification.service.js';

const formStatusValues = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
const formPurposeValues = [
  'GENERAL',
  'CLIENT_ONBOARDING',
  'REQUIREMENTS',
  'LEAD_CAPTURE',
  'SURVEY',
  'FEEDBACK',
  'SERVICE_REQUEST',
] as const;
const fieldTypeValues = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'NUMBER',
  'URL',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'RADIO',
  'CHECKBOX',
  'BOOLEAN',
] as const;

const optionSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(120),
    }),
  )
  .max(50)
  .optional();

export const createFormSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  purpose: z.enum(formPurposeValues).default('GENERAL'),
});

export const updateFormSchema = createFormSchema.partial().extend({
  status: z.enum(formStatusValues).optional(),
});

export const fieldSchema = z
  .object({
    key: z.string().trim().min(1).max(80).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Use letters, numbers, and underscores.'),
    label: z.string().trim().min(1).max(160),
    type: z.enum(fieldTypeValues),
    placeholder: z.string().trim().max(200).optional().or(z.literal('')),
    helpText: z.string().trim().max(300).optional().or(z.literal('')),
    required: z.boolean().default(false),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    options: optionSchema,
    validation: z.record(z.unknown()).optional(),
  })
  .superRefine((payload, context) => {
    if (['SELECT', 'MULTISELECT', 'RADIO'].includes(payload.type) && (!payload.options || payload.options.length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Options are required for this field type.',
      });
    }
  });

export const reorderSchema = z.object({
  fieldIds: z.array(z.string().min(1)).min(1),
});

export const publicLinkSchema = z
  .object({
    expiresAt: z.coerce.date().optional().nullable(),
    maxUses: z.coerce.number().int().positive().max(100000).optional().nullable(),
    contactId: z.string().optional().or(z.literal('')),
    dealId: z.string().optional().or(z.literal('')),
  })
  .superRefine((payload, context) => {
    if (payload.expiresAt && payload.expiresAt <= new Date()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiry must be in the future.' });
    }
  });

export const publicSubmissionSchema = z.object({
  values: z.record(z.unknown()),
  website: z.string().optional().default(''),
});

export const submissionStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'REVIEWED', 'COMPLETED']),
});

export class FormsError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

async function uniqueSlug(companyId: string, name: string, requestedSlug?: string | null, excludeId?: string) {
  const base = slugify(requestedSlug || name) || 'form';
  let candidate = base;
  let suffix = 1;

  while (
    await prisma.form.findFirst({
      where: {
        companyId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function rawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function shouldPersistSubmissionValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new FormsError(400, 'FORM_VALUE_NOT_SERIALIZABLE', 'One or more form values are invalid.');
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toInputJsonValue(item)) as Prisma.InputJsonArray;
  }
  if (isPlainJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, nestedValue === null ? null : toInputJsonValue(nestedValue)]),
    ) as Prisma.InputJsonObject;
  }
  throw new FormsError(400, 'FORM_VALUE_NOT_SERIALIZABLE', 'One or more form values are invalid.');
}

export function sanitizeSubmissionValues(fields: Array<{ id: string; key: string }>, values: SubmissionValueMap) {
  return fields
    .map((field) => ({ fieldId: field.id, value: values[field.key] }))
    .filter((item) => shouldPersistSubmissionValue(item.value))
    .map((item) => ({
      fieldId: item.fieldId,
      value: toInputJsonValue(item.value),
    }));
}

function getPublicSubmissionFields(
  fields: Awaited<ReturnType<typeof getPublicFormByToken>>['form']['fields'],
  systemKey: string | null,
  values: SubmissionValueMap,
) {
  if (!isCode2CrestClientOnboarding(systemKey)) return fields;
  const visibleKeys = getCode2CrestOnboardingVisibleFieldKeys(values);
  return fields.filter((field) => visibleKeys.has(field.key));
}

function formWhere(auth: AuthPayload): Prisma.FormWhereInput {
  return { companyId: auth.companyId };
}

async function getScopedForm(auth: AuthPayload, formId: string) {
  const form = await prisma.form.findFirst({
    where: { id: formId, ...formWhere(auth) },
    include: {
      fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      _count: { select: { fields: true, submissions: true } },
    },
  });

  if (!form) throw new FormsError(404, 'FORM_NOT_FOUND', 'Form not found');
  return form;
}

async function ensureAssociations(companyId: string, contactId?: string | null, dealId?: string | null) {
  const normalizedContactId = emptyToNull(contactId);
  const normalizedDealId = emptyToNull(dealId);

  if (normalizedContactId) {
    const contact = await prisma.contact.findFirst({ where: { id: normalizedContactId, companyId }, select: { id: true } });
    if (!contact) throw new FormsError(400, 'CONTACT_NOT_FOUND', 'Contact not found');
  }

  if (normalizedDealId) {
    const deal = await prisma.deal.findFirst({ where: { id: normalizedDealId, companyId }, select: { id: true, contactId: true } });
    if (!deal) throw new FormsError(400, 'DEAL_NOT_FOUND', 'Deal not found');
    if (normalizedContactId && deal.contactId !== normalizedContactId) {
      throw new FormsError(400, 'DEAL_CONTACT_MISMATCH', 'Deal does not belong to selected contact');
    }
  }

  return { contactId: normalizedContactId, dealId: normalizedDealId };
}

export async function listForms(auth: AuthPayload) {
  return prisma.form.findMany({
    where: formWhere(auth),
    include: { _count: { select: { fields: true, submissions: true } } },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createForm(auth: AuthPayload, input: z.infer<typeof createFormSchema>) {
  const slug = await uniqueSlug(auth.companyId, input.name, input.slug);
  const form = await prisma.form.create({
    data: {
      companyId: auth.companyId,
      createdById: auth.userId,
      name: input.name,
      slug,
      description: emptyToNull(input.description),
      purpose: input.purpose as FormPurpose,
    },
    include: { fields: true, _count: { select: { fields: true, submissions: true } } },
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    eventType: ACTIVITY_TYPES.FORM_CREATED,
    metadata: { formName: form.name, formId: form.id, purpose: form.purpose },
  });

  return form;
}

export async function getForm(auth: AuthPayload, formId: string) {
  return getScopedForm(auth, formId);
}

export async function updateForm(auth: AuthPayload, formId: string, input: z.infer<typeof updateFormSchema>) {
  await getScopedForm(auth, formId);
  const slug = input.name || input.slug ? await uniqueSlug(auth.companyId, input.name || input.slug || 'form', input.slug, formId) : undefined;
  const form = await prisma.form.update({
    where: { id: formId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) } : {}),
      ...(input.purpose ? { purpose: input.purpose as FormPurpose } : {}),
      ...(input.status ? { status: input.status as FormStatus } : {}),
    },
    include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }, _count: { select: { fields: true, submissions: true } } },
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    eventType: ACTIVITY_TYPES.FORM_UPDATED,
    metadata: { formName: form.name, formId: form.id, purpose: form.purpose },
  });

  return form;
}

export async function archiveForm(auth: AuthPayload, formId: string) {
  const form = await updateForm(auth, formId, { status: 'ARCHIVED' });
  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    eventType: ACTIVITY_TYPES.FORM_ARCHIVED,
    metadata: { formName: form.name, formId: form.id, purpose: form.purpose },
  });
  return form;
}

export async function publishForm(auth: AuthPayload, formId: string) {
  const existing = await getScopedForm(auth, formId);
  if (existing.fields.length === 0) {
    throw new FormsError(400, 'FORM_HAS_NO_FIELDS', 'Add at least one field before publishing');
  }
  const form = await prisma.form.update({
    where: { id: existing.id },
    data: { status: 'ACTIVE' },
    include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }, _count: { select: { fields: true, submissions: true } } },
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    eventType: ACTIVITY_TYPES.FORM_PUBLISHED,
    metadata: { formName: form.name, formId: form.id, purpose: form.purpose },
  });
  return form;
}

export async function deleteForm(auth: AuthPayload, formId: string) {
  const form = await getScopedForm(auth, formId);
  await prisma.form.delete({ where: { id: form.id } });
  return { id: form.id };
}

export async function createField(auth: AuthPayload, formId: string, input: z.infer<typeof fieldSchema>) {
  const form = await getScopedForm(auth, formId);
  return prisma.formField.create({
    data: {
      formId: form.id,
      key: input.key,
      label: input.label,
      type: input.type as FormFieldType,
      placeholder: emptyToNull(input.placeholder),
      helpText: emptyToNull(input.helpText),
      required: input.required,
      order: input.order,
      options: input.options as Prisma.InputJsonValue,
      validation: input.validation as Prisma.InputJsonValue,
    },
  });
}

export async function updateField(auth: AuthPayload, formId: string, fieldId: string, input: z.infer<typeof fieldSchema>) {
  await getScopedForm(auth, formId);
  const field = await prisma.formField.findFirst({ where: { id: fieldId, formId } });
  if (!field) throw new FormsError(404, 'FIELD_NOT_FOUND', 'Field not found');

  return prisma.formField.update({
    where: { id: field.id },
    data: {
      key: input.key,
      label: input.label,
      type: input.type as FormFieldType,
      placeholder: emptyToNull(input.placeholder),
      helpText: emptyToNull(input.helpText),
      required: input.required,
      order: input.order,
      options: input.options as Prisma.InputJsonValue,
      validation: input.validation as Prisma.InputJsonValue,
    },
  });
}

export async function deleteField(auth: AuthPayload, formId: string, fieldId: string) {
  await getScopedForm(auth, formId);
  const field = await prisma.formField.findFirst({ where: { id: fieldId, formId } });
  if (!field) throw new FormsError(404, 'FIELD_NOT_FOUND', 'Field not found');
  await prisma.formField.delete({ where: { id: field.id } });
  return { id: field.id };
}

export async function reorderFields(auth: AuthPayload, formId: string, fieldIds: string[]) {
  await getScopedForm(auth, formId);
  const count = await prisma.formField.count({ where: { formId, id: { in: fieldIds } } });
  if (count !== fieldIds.length) throw new FormsError(400, 'INVALID_FIELD_ORDER', 'Field order contains invalid fields');

  await prisma.$transaction(
    fieldIds.map((id, index) => prisma.formField.update({ where: { id }, data: { order: index } })),
  );

  return prisma.formField.findMany({ where: { formId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
}

export async function createPublicLink(auth: AuthPayload, formId: string, input: z.infer<typeof publicLinkSchema>, origin?: string) {
  const form = await getScopedForm(auth, formId);
  const associations = await ensureAssociations(auth.companyId, input.contactId, input.dealId);
  const token = rawToken();
  const link = await prisma.publicFormToken.create({
    data: {
      formId: form.id,
      companyId: auth.companyId,
      tokenHash: hashToken(token),
      expiresAt: input.expiresAt ?? null,
      maxUses: input.maxUses ?? null,
      contactId: associations.contactId,
      dealId: associations.dealId,
    },
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    eventType: ACTIVITY_TYPES.FORM_LINK_CREATED,
    contactId: associations.contactId,
    dealId: associations.dealId,
    metadata: { formName: form.name, formId: form.id, purpose: form.purpose },
  });

  const baseUrl = (origin || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return { ...link, token, url: `${baseUrl}/forms/${token}` };
}

export async function listPublicLinks(auth: AuthPayload, formId: string) {
  await getScopedForm(auth, formId);
  return prisma.publicFormToken.findMany({
    where: { formId, companyId: auth.companyId },
    include: {
      contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
      deal: { select: { title: true, stage: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deletePublicLink(auth: AuthPayload, formId: string, linkId: string) {
  await getScopedForm(auth, formId);
  const link = await prisma.publicFormToken.findFirst({ where: { id: linkId, formId, companyId: auth.companyId } });
  if (!link) throw new FormsError(404, 'LINK_NOT_FOUND', 'Public link not found');
  await prisma.publicFormToken.update({ where: { id: link.id }, data: { isActive: false } });
  return { id: link.id };
}

export async function listSubmissions(auth: AuthPayload, formId: string) {
  await getScopedForm(auth, formId);
  return prisma.formSubmission.findMany({
    where: { formId, companyId: auth.companyId },
    include: {
      contact: { select: { firstName: true, lastName: true, phoneNumber: true } },
      deal: { select: { title: true, stage: true } },
      _count: { select: { values: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
}

export async function getSubmission(auth: AuthPayload, formId: string, submissionId: string) {
  await getScopedForm(auth, formId);
  const submission = await prisma.formSubmission.findFirst({
    where: { id: submissionId, formId, companyId: auth.companyId },
    include: {
      form: { include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } } },
      values: { include: { field: true } },
      contact: { select: { firstName: true, lastName: true, phoneNumber: true, email: true } },
      deal: { select: { title: true, stage: true } },
    },
  });
  if (!submission) throw new FormsError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  return submission;
}

export async function updateSubmissionStatus(auth: AuthPayload, formId: string, submissionId: string, status: FormSubmissionStatus) {
  const submission = await getSubmission(auth, formId, submissionId);
  const updated = await prisma.formSubmission.update({ where: { id: submission.id }, data: { status } });
  if (status === 'REVIEWED' || status === 'COMPLETED') {
    if (submission.form.systemKey === 'CODE2CREST_CLIENT_ONBOARDING' && submission.dealId) {
      await prisma.deal.updateMany({
        where: { id: submission.dealId, companyId: auth.companyId },
        data: { onboardingStatus: status === 'COMPLETED' ? 'COMPLETED' : 'UNDER_REVIEW' },
      });
    }

    await createActivityLog({
      companyId: auth.companyId,
      userId: auth.userId,
      contactId: submission.contactId,
      dealId: submission.dealId,
      eventType:
        submission.form.systemKey === 'CODE2CREST_CLIENT_ONBOARDING'
          ? status === 'REVIEWED'
            ? ACTIVITY_TYPES.CLIENT_ONBOARDING_REVIEW_STARTED
            : ACTIVITY_TYPES.CLIENT_ONBOARDING_COMPLETED
          : status === 'REVIEWED'
            ? ACTIVITY_TYPES.FORM_SUBMISSION_REVIEWED
            : ACTIVITY_TYPES.FORM_SUBMISSION_COMPLETED,
      metadata: { formName: submission.form.name, submissionId: submission.id, purpose: submission.form.purpose },
    });
  }
  return updated;
}

export async function getPublicFormByToken(token: string) {
  const link = await prisma.publicFormToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      form: { include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } } },
      company: { select: { name: true, logoUrl: true } },
      contact: { select: { firstName: true, lastName: true, email: true, phoneNumber: true, companyName: true } },
      deal: { select: { title: true, source: true } },
    },
  });

  if (!link || !link.isActive || link.form.status !== 'ACTIVE') {
    throw new FormsError(404, 'PUBLIC_FORM_NOT_AVAILABLE', 'This form link is invalid or has expired.');
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new FormsError(410, 'PUBLIC_FORM_EXPIRED', 'This form link is invalid or has expired.');
  }
  if (link.maxUses !== null && link.usedCount >= link.maxUses) {
    throw new FormsError(410, 'PUBLIC_FORM_MAX_USES_REACHED', 'This form is no longer accepting responses.');
  }

  await updateDealOnboardingFromPublicView({
    companyId: link.companyId,
    dealId: link.dealId,
    formSystemKey: link.form.systemKey,
  });

  return link;
}

export async function submitPublicForm(token: string, input: z.infer<typeof publicSubmissionSchema>) {
  if (input.website.trim()) {
    return { honeypot: true as const };
  }

  const link = await getPublicFormByToken(token);
  const values = input.values as SubmissionValueMap;
  const validFieldKeys = new Set(link.form.fields.map((field) => field.key));
  const unknownFieldErrors = Object.fromEntries(
    Object.keys(values)
      .filter((key) => !validFieldKeys.has(key))
      .map((key) => [key, 'Unknown field.']),
  );
  if (Object.keys(unknownFieldErrors).length > 0) {
    throw new FormSubmissionValidationError(unknownFieldErrors);
  }

  const submissionFields = getPublicSubmissionFields(link.form.fields, link.form.systemKey, values);
  const visibleValues = Object.fromEntries(submissionFields.map((field) => [field.key, values[field.key]]));
  validateSubmissionValues(submissionFields, visibleValues);
  const submittedBy = getSubmittedBy(submissionFields, visibleValues);
  const submissionValues = sanitizeSubmissionValues(submissionFields, visibleValues);

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.formSubmission.create({
      data: {
        formId: link.formId,
        companyId: link.companyId,
        contactId: link.contactId,
        dealId: link.dealId,
        submittedByName: submittedBy.submittedByName,
        submittedByEmail: submittedBy.submittedByEmail,
        values: {
          create: submissionValues,
        },
      },
    });

    await tx.publicFormToken.update({
      where: { id: link.id },
      data: { usedCount: { increment: 1 } },
    });

    return created;
  });

  await createActivityLog({
    companyId: link.companyId,
    contactId: link.contactId,
    dealId: link.dealId,
    eventType: ACTIVITY_TYPES.FORM_SUBMITTED,
    metadata: { formName: link.form.name, submissionId: submission.id, purpose: link.form.purpose },
  });

  await updateDealOnboardingFromSubmission({
    companyId: link.companyId,
    contactId: link.contactId,
    dealId: link.dealId,
    formSystemKey: link.form.systemKey,
    submissionId: submission.id,
  });

  notifyFormSubmission({ companyId: link.companyId, formId: link.formId, submissionId: submission.id }).catch(() => undefined);

  return { submissionId: submission.id, honeypot: false as const };
}

export { FormSubmissionValidationError };
