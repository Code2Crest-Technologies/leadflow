import crypto from 'crypto';
import type { DealOnboardingStatus, FormFieldType, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import type { ActivityType } from '../constants/activityTypes.js';
import { getDealWhere } from '../middleware/permissions.js';
import type { AuthPayload } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { createActivityLog } from './activityLog.service.js';
import { sendEmail } from './email.service.js';

export const CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY = 'CODE2CREST_CLIENT_ONBOARDING';
const TEMPLATE_SLUG = 'code2crest-client-onboarding';
const TEMPLATE_NAME = 'Code2Crest Client Onboarding';
const TOKEN_DAYS = 30;
const REMINDER_DAYS = [3, 7, 14] as const;

const WEBSITE_SERVICE_TYPES = new Set(['Website Development', 'Web Application Development', 'E-Commerce Solutions']);
const SOFTWARE_SERVICE_TYPES = new Set(['Mobile App Development', 'Custom Software Development', 'SaaS / Product Development']);
const MAINTENANCE_SERVICE_TYPES = new Set(['Maintenance & Support']);

export const ONBOARDING_SECTION_KEYS = {
  Business: [
  'primaryContactName',
  'companyName',
  'businessEmail',
  'phone',
  'whatsappNumber',
  'businessWebsite',
  'industry',
  'businessAddress',
  'gstin',
  ],
  Project: [
  'projectName',
  'serviceType',
  'projectSummary',
  'primaryBusinessGoal',
  'targetAudience',
  'referenceWebsites',
  'competitors',
  'expectedLaunchDate',
  ],
  'Brand & Content': [
    'hasLogo',
    'brandColors',
    'brandFonts',
    'brandGuidelinesAvailable',
    'brandingNotes',
    'contentProvider',
    'hasCompanyProfile',
    'hasProductServiceContent',
    'hasImages',
    'hasVideos',
    'contentNotes',
  ],
  Website: [
    'existingDomain',
    'domainName',
    'domainProvider',
    'existingHosting',
    'hostingProvider',
    'estimatedPages',
    'cmsRequired',
    'blogRequired',
    'whatsappIntegration',
    'paymentGatewayRequired',
    'multilingualRequired',
    'seoRequired',
    'analyticsRequired',
    'googleBusinessProfileRequired',
  ],
  Software: [
    'userRolesRequired',
    'coreFeatures',
    'adminDashboardRequired',
    'authenticationRequired',
    'paymentIntegrationRequired',
    'thirdPartyIntegrations',
    'reportsRequired',
    'notificationsRequired',
    'existingApis',
    'expectedUsers',
  ],
  Maintenance: [
    'existingSystemUrl',
    'currentTechnology',
    'supportType',
    'issueSummary',
    'maintenanceFrequency',
    'accessRequired',
  ],
  'Technical Access': [
    'domainAccessRequired',
    'hostingAccessRequired',
    'googleAccessRequired',
    'metaBusinessAccessRequired',
    'technicalNotes',
  ],
  Consent: [
  'additionalRequirements',
  'informationConfirmed',
  'onboardingConsent',
  ],
} as const;

const ALWAYS_VISIBLE_ONBOARDING_KEYS = [
  ...ONBOARDING_SECTION_KEYS.Business,
  ...ONBOARDING_SECTION_KEYS.Project,
  ...ONBOARDING_SECTION_KEYS.Consent,
];

const BRAND_CONTENT_ONBOARDING_KEYS = ONBOARDING_SECTION_KEYS['Brand & Content'];
const WEBSITE_ONBOARDING_KEYS = ONBOARDING_SECTION_KEYS.Website;
const SOFTWARE_ONBOARDING_KEYS = ONBOARDING_SECTION_KEYS.Software;
const MAINTENANCE_ONBOARDING_KEYS = ONBOARDING_SECTION_KEYS.Maintenance;
const TECHNICAL_ONBOARDING_KEYS = ONBOARDING_SECTION_KEYS['Technical Access'];

export function isCode2CrestClientOnboarding(systemKey?: string | null) {
  return systemKey === CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY;
}

export function getCode2CrestOnboardingVisibleFieldKeys(values: Record<string, unknown>) {
  const serviceType = typeof values.serviceType === 'string' ? values.serviceType : '';
  const visibleKeys = new Set<string>(ALWAYS_VISIBLE_ONBOARDING_KEYS);

  if (!serviceType || WEBSITE_SERVICE_TYPES.has(serviceType) || SOFTWARE_SERVICE_TYPES.has(serviceType) || serviceType === 'Other') {
    BRAND_CONTENT_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
  }

  if (WEBSITE_SERVICE_TYPES.has(serviceType)) {
    WEBSITE_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
    TECHNICAL_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
  }

  if (SOFTWARE_SERVICE_TYPES.has(serviceType)) {
    SOFTWARE_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
    TECHNICAL_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
  }

  if (MAINTENANCE_SERVICE_TYPES.has(serviceType)) {
    MAINTENANCE_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
    TECHNICAL_ONBOARDING_KEYS.forEach((key) => visibleKeys.add(key));
  }

  return visibleKeys;
}

export class ClientOnboardingError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type OnboardingField = {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ label: string; value: string }>;
};

export const code2crestOnboardingFields: OnboardingField[] = [
  { key: 'primaryContactName', label: 'Primary contact name', type: 'TEXT', required: true },
  { key: 'companyName', label: 'Company name', type: 'TEXT', required: true },
  { key: 'businessEmail', label: 'Business email', type: 'EMAIL', required: true },
  { key: 'phone', label: 'Phone', type: 'PHONE', required: true },
  { key: 'whatsappNumber', label: 'WhatsApp number', type: 'PHONE' },
  { key: 'businessWebsite', label: 'Business website', type: 'URL' },
  { key: 'industry', label: 'Industry', type: 'TEXT', required: true },
  { key: 'businessAddress', label: 'Business address', type: 'TEXTAREA' },
  { key: 'gstin', label: 'GSTIN', type: 'TEXT' },
  { key: 'projectName', label: 'Project name', type: 'TEXT', required: true },
  {
    key: 'serviceType',
    label: 'Service type',
    type: 'SELECT',
    required: true,
    options: [
      'Website Development',
      'Web Application Development',
      'E-Commerce Solutions',
      'Mobile App Development',
      'Custom Software Development',
      'Maintenance & Support',
      'SaaS / Product Development',
      'Other',
    ].map((value) => ({ label: value, value })),
  },
  { key: 'projectSummary', label: 'Project summary', type: 'TEXTAREA', required: true },
  { key: 'primaryBusinessGoal', label: 'Primary business goal', type: 'TEXTAREA', required: true },
  { key: 'targetAudience', label: 'Target audience', type: 'TEXTAREA' },
  { key: 'referenceWebsites', label: 'Reference websites', type: 'TEXTAREA' },
  { key: 'competitors', label: 'Competitors', type: 'TEXTAREA' },
  { key: 'expectedLaunchDate', label: 'Expected launch date', type: 'DATE' },
  { key: 'hasLogo', label: 'Do you have a logo?', type: 'BOOLEAN', required: true, placeholder: 'Yes' },
  { key: 'brandColors', label: 'Brand colors', type: 'TEXT' },
  { key: 'brandFonts', label: 'Brand fonts', type: 'TEXT' },
  { key: 'brandGuidelinesAvailable', label: 'Brand guidelines available?', type: 'BOOLEAN', placeholder: 'Yes' },
  {
    key: 'brandingNotes',
    label: 'Branding notes',
    type: 'TEXTAREA',
    helpText: 'Brand asset upload support will be added separately.',
  },
  {
    key: 'contentProvider',
    label: 'Who will provide content?',
    type: 'RADIO',
    required: true,
    options: ['Client', 'Code2Crest', 'Both'].map((value) => ({ label: value, value })),
  },
  { key: 'hasCompanyProfile', label: 'Company profile content available?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'hasProductServiceContent', label: 'Product/service content available?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'hasImages', label: 'Images available?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'hasVideos', label: 'Videos available?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'contentNotes', label: 'Content notes', type: 'TEXTAREA' },
  { key: 'existingDomain', label: 'Existing domain?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'domainName', label: 'Domain name', type: 'TEXT' },
  { key: 'domainProvider', label: 'Domain provider', type: 'TEXT' },
  { key: 'existingHosting', label: 'Existing hosting?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'hostingProvider', label: 'Hosting provider', type: 'TEXT' },
  { key: 'estimatedPages', label: 'Estimated pages', type: 'NUMBER' },
  { key: 'cmsRequired', label: 'CMS required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'blogRequired', label: 'Blog required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'whatsappIntegration', label: 'WhatsApp integration required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'paymentGatewayRequired', label: 'Payment gateway required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'multilingualRequired', label: 'Multilingual required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'seoRequired', label: 'SEO required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'analyticsRequired', label: 'Analytics required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'googleBusinessProfileRequired', label: 'Google Business Profile required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'userRolesRequired', label: 'User roles required', type: 'TEXTAREA' },
  { key: 'coreFeatures', label: 'Core features', type: 'TEXTAREA' },
  { key: 'adminDashboardRequired', label: 'Admin dashboard required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'authenticationRequired', label: 'Authentication required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'paymentIntegrationRequired', label: 'Payment integration required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'thirdPartyIntegrations', label: 'Third-party integrations', type: 'TEXTAREA' },
  { key: 'reportsRequired', label: 'Reports required', type: 'TEXTAREA' },
  { key: 'notificationsRequired', label: 'Notifications required', type: 'TEXTAREA' },
  { key: 'existingApis', label: 'Existing APIs', type: 'TEXTAREA' },
  { key: 'expectedUsers', label: 'Expected users', type: 'NUMBER' },
  { key: 'existingSystemUrl', label: 'Existing system URL', type: 'URL' },
  { key: 'currentTechnology', label: 'Current technology stack', type: 'TEXT' },
  {
    key: 'supportType',
    label: 'Support type',
    type: 'SELECT',
    options: ['Bug fixes', 'Enhancements', 'Security updates', 'Ongoing maintenance', 'Other'].map((value) => ({ label: value, value })),
  },
  { key: 'issueSummary', label: 'Issue or support summary', type: 'TEXTAREA' },
  {
    key: 'maintenanceFrequency',
    label: 'Maintenance frequency',
    type: 'SELECT',
    options: ['One-time', 'Weekly', 'Monthly', 'Quarterly', 'As needed'].map((value) => ({ label: value, value })),
  },
  { key: 'accessRequired', label: 'Will Code2Crest need system access?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'domainAccessRequired', label: 'Domain access required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'hostingAccessRequired', label: 'Hosting access required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'googleAccessRequired', label: 'Google access required?', type: 'BOOLEAN', placeholder: 'Yes' },
  { key: 'metaBusinessAccessRequired', label: 'Meta Business access required?', type: 'BOOLEAN', placeholder: 'Yes' },
  {
    key: 'technicalNotes',
    label: 'Technical notes',
    type: 'TEXTAREA',
    helpText:
      'Do not enter passwords or sensitive credentials in this form. Code2Crest will provide secure instructions for granting access where required.',
  },
  { key: 'additionalRequirements', label: 'Additional requirements', type: 'TEXTAREA', helpText: 'File upload support coming soon.' },
  {
    key: 'informationConfirmed',
    label: 'I confirm that the information provided is accurate to the best of my knowledge.',
    type: 'BOOLEAN',
    required: true,
    placeholder: 'I confirm',
  },
  {
    key: 'onboardingConsent',
    label: 'I understand that project scope, cost, and timelines are governed by the approved quotation, proposal, agreement, or Statement of Work.',
    type: 'BOOLEAN',
    required: true,
    placeholder: 'I understand',
  },
];

function code2crestCompanyId() {
  const companyId = process.env.CODE2CREST_LEADFLOW_COMPANY_ID?.trim();
  if (!companyId) {
    throw new ClientOnboardingError(503, 'CODE2CREST_COMPANY_NOT_CONFIGURED', 'Code2Crest onboarding company is not configured');
  }
  return companyId;
}

function assertCode2CrestTenant(auth: AuthPayload) {
  const companyId = code2crestCompanyId();
  if (auth.companyId !== companyId) {
    throw new ClientOnboardingError(403, 'CODE2CREST_TENANT_REQUIRED', 'Client onboarding is available only for the Code2Crest tenant');
  }
  return companyId;
}

function assertCanManageOnboarding(auth: AuthPayload) {
  if (!['ADMIN', 'MANAGER'].includes(auth.role)) {
    throw new ClientOnboardingError(403, 'ONBOARDING_PERMISSION_DENIED', 'You do not have permission to manage client onboarding');
  }
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function publicFormUrl(token: string) {
  const fallback =
    process.env.NODE_ENV === 'production'
      ? 'https://www.code2crest.com/onboarding'
      : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding`;
  const baseUrl = (process.env.CODE2CREST_ONBOARDING_BASE_URL || process.env.PUBLIC_ONBOARDING_BASE_URL || fallback).replace(/\/+$/, '');
  return `${baseUrl}/${token}`;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function fieldData(field: OnboardingField, formId: string, order: number): Prisma.FormFieldUncheckedCreateInput {
  return {
    formId,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    order,
    placeholder: field.placeholder ?? null,
    helpText: field.helpText ?? null,
    options: field.options ? (field.options as Prisma.InputJsonValue) : undefined,
    validation: undefined,
  };
}

async function findTemplate(companyId: string) {
  return prisma.form.findFirst({
    where: { companyId, systemKey: CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY },
    include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
  });
}

async function resolveTemplateCreator(companyId: string, createdById?: string) {
  if (createdById) {
    const user = await prisma.user.findFirst({ where: { id: createdById, companyId }, select: { id: true } });
    if (user) return user.id;
  }

  const owner = await prisma.user.findFirst({
    where: { companyId, status: 'ACTIVE', role: { in: ['ADMIN', 'MANAGER'] } },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  if (!owner) {
    throw new ClientOnboardingError(409, 'CODE2CREST_TEMPLATE_CREATOR_MISSING', 'No active Code2Crest admin user was found');
  }

  return owner.id;
}

export async function ensureCode2CrestClientOnboardingTemplate(createdById?: string) {
  const companyId = code2crestCompanyId();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) {
    throw new ClientOnboardingError(404, 'CODE2CREST_COMPANY_NOT_FOUND', 'Code2Crest tenant was not found');
  }

  const creatorId = await resolveTemplateCreator(companyId, createdById);
  const existing = await findTemplate(companyId);
  const form =
    existing ||
    (await prisma.form.create({
      data: {
        companyId,
        createdById: creatorId,
        name: TEMPLATE_NAME,
        slug: TEMPLATE_SLUG,
        systemKey: CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY,
        purpose: 'CLIENT_ONBOARDING',
        status: 'ACTIVE',
        description:
          'Collect business, project, branding, content, and technical requirements before project kickoff.',
      },
      include: { fields: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] } },
    }));

  if (existing) {
    await prisma.form.update({
      where: { id: form.id },
      data: {
        name: TEMPLATE_NAME,
        slug: TEMPLATE_SLUG,
        systemKey: CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY,
        purpose: 'CLIENT_ONBOARDING',
        status: form.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
        description:
          'Collect business, project, branding, content, and technical requirements before project kickoff.',
      },
    });
  }

  await prisma.$transaction(
    code2crestOnboardingFields.map((field, index) =>
      prisma.formField.upsert({
        where: { formId_key: { formId: form.id, key: field.key } },
        update: fieldData(field, form.id, index),
        create: fieldData(field, form.id, index),
      }),
    ),
  );

  return (await findTemplate(companyId))!;
}

async function getScopedWonDeal(auth: AuthPayload, dealId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
    include: {
      contact: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      company: { select: { id: true, name: true, logoUrl: true, email: true, phone: true, website: true } },
    },
  });

  if (!deal) throw new ClientOnboardingError(404, 'DEAL_NOT_FOUND', 'Deal not found');
  if (deal.stage !== 'WON') {
    throw new ClientOnboardingError(400, 'DEAL_MUST_BE_WON', 'Client onboarding can start only from a WON deal');
  }
  return deal;
}

async function latestOnboardingToken(companyId: string, formId: string, dealId: string) {
  return prisma.publicFormToken.findFirst({
    where: { companyId, formId, dealId },
    orderBy: { createdAt: 'desc' },
  });
}

async function latestOnboardingSubmission(companyId: string, formId: string, dealId: string) {
  return prisma.formSubmission.findFirst({
    where: { companyId, formId, dealId },
    include: {
      values: {
        include: { field: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });
}

function contactDisplayName(contact: { firstName: string; lastName?: string | null; contactPersonName?: string | null; companyName?: string | null }) {
  return contact.contactPersonName || [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.companyName || 'Client';
}

function normalizePhoneForWhatsApp(phoneCountryCode?: string | null, phoneNumber?: string | null) {
  const raw = `${phoneCountryCode || ''}${phoneNumber || ''}`.replace(/[^\d]/g, '');
  return raw || null;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value?: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value)
    : 'Not set';
}

function textValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

type SubmissionWithValues = NonNullable<Awaited<ReturnType<typeof latestOnboardingSubmission>>>;

export function groupOnboardingSubmissionValues(submission?: SubmissionWithValues | null) {
  if (!submission) return [];
  const valuesByKey = new Map(submission.values.map((item) => [item.field.key, item]));

  return Object.entries(ONBOARDING_SECTION_KEYS)
    .map(([section, keys]) => ({
      section,
      answers: keys
        .map((key) => valuesByKey.get(key))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => ({
          key: item.field.key,
          label: item.field.label,
          value: item.value,
          displayValue: textValue(item.value),
        })),
    }))
    .filter((group) => group.answers.length > 0);
}

function buildClientOnboardingEmail(input: {
  clientName: string;
  companyName?: string | null;
  projectName: string;
  onboardingUrl: string;
  expiresAt?: Date | null;
  reminder?: boolean;
}) {
  const subject = input.reminder
    ? 'Reminder: Complete Your Project Onboarding - Code2Crest Technologies'
    : 'Complete Your Project Onboarding - Code2Crest Technologies';
  const intro = input.reminder
    ? 'This is a friendly reminder to complete your secure project onboarding form.'
    : 'Thank you for choosing Code2Crest Technologies. Please complete your secure project onboarding form before kickoff.';
  const html = `
    <div style="margin:0;background:#f0ede4;padding:28px;font-family:Arial,sans-serif;color:#10201d;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ddd8cd;border-radius:18px;overflow:hidden;">
        <tr><td style="background:#004741;padding:24px 28px;color:#ffffff;">
          <div style="font-size:20px;font-weight:800;">Code2Crest Technologies</div>
          <div style="margin-top:6px;color:#d7ede9;font-size:13px;">Project onboarding</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 14px;font-size:16px;">Hi ${escapeHtml(input.clientName)},</p>
          <p style="margin:0 0 18px;line-height:1.6;color:#4f625d;">${intro}</p>
          <div style="background:#f0ede4;border-radius:14px;padding:16px;margin:18px 0;">
            <div style="font-size:12px;color:#6b7a75;text-transform:uppercase;letter-spacing:0.12em;">Project</div>
            <div style="margin-top:6px;font-size:18px;font-weight:700;">${escapeHtml(input.projectName)}</div>
            ${input.companyName ? `<div style="margin-top:4px;color:#6b7a75;">${escapeHtml(input.companyName)}</div>` : ''}
          </div>
          <a href="${escapeHtml(input.onboardingUrl)}" style="display:inline-block;background:#004741;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700;">Complete Onboarding</a>
          <a href="mailto:hello@code2crest.com" style="display:inline-block;margin-left:10px;color:#004741;text-decoration:none;font-weight:700;">Contact Our Team</a>
          <p style="margin:22px 0 0;color:#6b7a75;font-size:13px;line-height:1.6;">If the button does not work, copy this secure URL:<br>${escapeHtml(input.onboardingUrl)}</p>
          <p style="margin:14px 0 0;color:#6b7a75;font-size:13px;">Link expiry: ${formatDate(input.expiresAt)}</p>
        </td></tr>
        <tr><td style="border-top:1px solid #ddd8cd;padding:18px 28px;color:#6b7a75;font-size:12px;">
          Code2Crest Technologies · www.code2crest.com · hello@code2crest.com
        </td></tr>
      </table>
    </div>
  `;
  const text = `Hi ${input.clientName},

${intro}

Project: ${input.projectName}
${input.companyName ? `Company: ${input.companyName}\n` : ''}
Secure onboarding link: ${input.onboardingUrl}
Expiry: ${formatDate(input.expiresAt)}

Thank you,
Code2Crest Technologies`;

  return { subject, html, text };
}

export function buildWhatsAppOnboardingShare(input: { clientName: string; onboardingUrl: string; phone?: string | null }) {
  const message = `Hi ${input.clientName},

Thank you for choosing Code2Crest Technologies.

Please complete your project onboarding using the secure link below:

${input.onboardingUrl}

This helps us understand your project requirements before kickoff.

Thank you,
Code2Crest Technologies`;
  const phone = input.phone ? input.phone.replace(/[^\d]/g, '') : '';
  return {
    message,
    url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
  };
}

type OnboardingTokenDeal = { id: string; contactId: string };

async function createOnboardingToken(auth: AuthPayload, deal: OnboardingTokenDeal, formId: string, eventType: ActivityType) {
  const token = createRawToken();
  const expiresAt = addDays(TOKEN_DAYS);
  const link = await prisma.publicFormToken.create({
    data: {
      companyId: auth.companyId,
      formId,
      contactId: deal.contactId,
      dealId: deal.id,
      tokenHash: tokenHash(token),
      expiresAt,
      maxUses: 1,
    },
  });

  await prisma.deal.update({
    where: { id: deal.id },
    data: { onboardingStatus: 'LINK_CREATED' },
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    contactId: deal.contactId,
    dealId: deal.id,
    eventType,
    metadata: { formName: TEMPLATE_NAME, status: 'LINK_CREATED' },
  });

  const url = publicFormUrl(token);
  sendClientOnboardingLink({ companyId: auth.companyId, dealId: deal.id, contactId: deal.contactId, url }).catch(() => undefined);
  return { ...link, token, url };
}

async function createFreshOnboardingToken(auth: AuthPayload, deal: OnboardingTokenDeal, formId: string, eventType: ActivityType) {
  await prisma.publicFormToken.updateMany({
    where: { companyId: auth.companyId, formId, dealId: deal.id, isActive: true },
    data: { isActive: false },
  });
  return createOnboardingToken(auth, deal, formId, eventType);
}

async function createEmailNotificationLog(input: {
  companyId: string;
  userId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  eventType: ActivityType;
  metadata: Prisma.InputJsonValue;
}) {
  await createActivityLog({
    companyId: input.companyId,
    userId: input.userId,
    contactId: input.contactId,
    dealId: input.dealId,
    eventType: input.eventType,
    metadata: input.metadata,
  });
}

export async function getDealOnboardingPanel(auth: AuthPayload, dealId: string) {
  const isCode2CrestTenant = process.env.CODE2CREST_LEADFLOW_COMPANY_ID?.trim() === auth.companyId;
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...getDealWhere(auth) },
    select: { id: true, stage: true, onboardingStatus: true },
  });

  if (!deal) return null;
  if (!isCode2CrestTenant) {
    return { isCode2CrestTenant, eligible: false, reason: 'Not a Code2Crest tenant', status: deal.onboardingStatus };
  }

  const template = await findTemplate(auth.companyId);
  const latestLink = template ? await latestOnboardingToken(auth.companyId, template.id, deal.id) : null;
  const latestSubmission = template ? await latestOnboardingSubmission(auth.companyId, template.id, deal.id) : null;
  const reminders = template
    ? await prisma.clientOnboardingReminder.findMany({
        where: { companyId: auth.companyId, dealId: deal.id },
        orderBy: { sentAt: 'desc' },
      })
    : [];

  return {
    isCode2CrestTenant,
    eligible: deal.stage === 'WON',
    reason: deal.stage === 'WON' ? null : 'Deal must be WON before onboarding can start',
    status: deal.onboardingStatus,
    template: template ? { id: template.id, name: template.name, status: template.status, systemKey: template.systemKey } : null,
    latestLink: latestLink
      ? {
          id: latestLink.id,
          createdAt: latestLink.createdAt,
          expiresAt: latestLink.expiresAt,
          maxUses: latestLink.maxUses,
          usedCount: latestLink.usedCount,
          isActive: latestLink.isActive,
          url: null,
        }
      : null,
    latestSubmission: latestSubmission
      ? {
          id: latestSubmission.id,
          status: latestSubmission.status,
          submittedAt: latestSubmission.submittedAt,
          sections: groupOnboardingSubmissionValues(latestSubmission),
        }
      : null,
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      reminderDay: reminder.reminderDay,
      channel: reminder.channel,
      sentAt: reminder.sentAt,
    })),
  };
}

export async function startClientOnboarding(auth: AuthPayload, dealId: string) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await ensureCode2CrestClientOnboardingTemplate(auth.userId);
  const existingActiveLink = await prisma.publicFormToken.findFirst({
    where: { companyId: auth.companyId, formId: template.id, dealId: deal.id, isActive: true },
    select: { id: true },
  });
  if (existingActiveLink) {
    throw new ClientOnboardingError(409, 'ONBOARDING_LINK_ALREADY_EXISTS', 'An active onboarding link already exists. Regenerate it if you need a fresh link.');
  }
  const link = await createOnboardingToken(auth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_CREATED);
  return { ...(await getDealOnboardingPanel(auth, dealId)), latestLink: { ...link, token: undefined } };
}

export async function regenerateClientOnboardingLink(auth: AuthPayload, dealId: string) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await ensureCode2CrestClientOnboardingTemplate(auth.userId);

  await prisma.publicFormToken.updateMany({
    where: { companyId: auth.companyId, formId: template.id, dealId: deal.id, isActive: true },
    data: { isActive: false },
  });

  const link = await createOnboardingToken(auth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED);
  return { ...(await getDealOnboardingPanel(auth, dealId)), latestLink: { ...link, token: undefined } };
}

export async function createCopyableClientOnboardingLink(auth: AuthPayload, dealId: string) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await ensureCode2CrestClientOnboardingTemplate(auth.userId);
  const latestLink = await latestOnboardingToken(auth.companyId, template.id, deal.id);
  const link = latestLink?.isActive
    ? await createFreshOnboardingToken(auth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED)
    : await createOnboardingToken(auth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_CREATED);
  return { ...(await getDealOnboardingPanel(auth, dealId)), latestLink: { ...link, token: undefined, url: link.url } };
}

export async function markClientOnboardingSent(auth: AuthPayload, dealId: string) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await findTemplate(auth.companyId);
  if (!template) throw new ClientOnboardingError(404, 'ONBOARDING_TEMPLATE_NOT_FOUND', 'Client onboarding template not found');

  const link = await latestOnboardingToken(auth.companyId, template.id, deal.id);
  if (!link || !link.isActive) {
    throw new ClientOnboardingError(400, 'ONBOARDING_LINK_REQUIRED', 'Create an onboarding link before marking it sent');
  }

  await prisma.deal.update({ where: { id: deal.id }, data: { onboardingStatus: 'SENT' } });
  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    contactId: deal.contactId,
    dealId: deal.id,
    eventType: ACTIVITY_TYPES.CLIENT_ONBOARDING_SENT,
    metadata: { formName: TEMPLATE_NAME, status: 'SENT' },
  });
  return getDealOnboardingPanel(auth, dealId);
}

export async function sendClientOnboardingEmail(auth: AuthPayload, dealId: string, reminder = false) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await ensureCode2CrestClientOnboardingTemplate(auth.userId);
  const link = await createFreshOnboardingToken(
    auth,
    deal,
    template.id,
    reminder ? ACTIVITY_TYPES.CLIENT_ONBOARDING_REMINDER_SENT : ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED,
  );
  const recipient = deal.contact.email;
  if (!recipient) {
    throw new ClientOnboardingError(400, 'CLIENT_EMAIL_REQUIRED', 'Client email is required to send onboarding.');
  }

  const clientName = contactDisplayName(deal.contact);
  const email = buildClientOnboardingEmail({
    clientName,
    companyName: deal.contact.companyName,
    projectName: deal.title,
    onboardingUrl: link.url,
    expiresAt: link.expiresAt,
    reminder,
  });
  const delivery = await sendEmail({
    to: recipient,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  await prisma.deal.update({ where: { id: deal.id }, data: { onboardingStatus: 'SENT' } });
  await createEmailNotificationLog({
    companyId: auth.companyId,
    userId: auth.userId,
    contactId: deal.contactId,
    dealId: deal.id,
    eventType: reminder ? ACTIVITY_TYPES.CLIENT_ONBOARDING_REMINDER_SENT : ACTIVITY_TYPES.CLIENT_ONBOARDING_EMAIL_SENT,
    metadata: {
      formName: TEMPLATE_NAME,
      status: 'SENT',
      provider: delivery.provider,
      sent: delivery.sent,
      emailId: delivery.id ?? null,
      recipient,
      reminder,
      reminderDay: null,
    },
  });

  return { ...(await getDealOnboardingPanel(auth, dealId)), latestLink: { ...link, token: undefined, url: link.url }, email: delivery };
}

export async function shareClientOnboardingViaWhatsApp(auth: AuthPayload, dealId: string) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await ensureCode2CrestClientOnboardingTemplate(auth.userId);
  const link = await createFreshOnboardingToken(auth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED);
  const clientName = contactDisplayName(deal.contact);
  const phone = normalizePhoneForWhatsApp(deal.contact.phoneCountryCode, deal.contact.phoneNumber);
  if (!phone) {
    throw new ClientOnboardingError(400, 'CLIENT_PHONE_REQUIRED', 'Client phone number is required for WhatsApp sharing.');
  }
  const share = buildWhatsAppOnboardingShare({ clientName, onboardingUrl: link.url, phone });

  await prisma.deal.update({ where: { id: deal.id }, data: { onboardingStatus: 'SENT' } });
  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    contactId: deal.contactId,
    dealId: deal.id,
    eventType: ACTIVITY_TYPES.CLIENT_ONBOARDING_WHATSAPP_SHARED,
    metadata: { formName: TEMPLATE_NAME, status: 'SENT' },
  });

  return { ...(await getDealOnboardingPanel(auth, dealId)), latestLink: { ...link, token: undefined, url: link.url }, whatsapp: share };
}

export async function updateOnboardingReviewStatus(auth: AuthPayload, dealId: string, status: Extract<DealOnboardingStatus, 'UNDER_REVIEW' | 'COMPLETED'>) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  const deal = await getScopedWonDeal(auth, dealId);
  const template = await findTemplate(auth.companyId);
  if (!template) throw new ClientOnboardingError(404, 'ONBOARDING_TEMPLATE_NOT_FOUND', 'Client onboarding template not found');

  const submission = await latestOnboardingSubmission(auth.companyId, template.id, deal.id);
  if (!submission) {
    throw new ClientOnboardingError(400, 'ONBOARDING_SUBMISSION_REQUIRED', 'No onboarding submission found for this deal');
  }

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({ where: { id: deal.id }, data: { onboardingStatus: status } });
    await tx.formSubmission.update({
      where: { id: submission.id },
      data: { status: status === 'COMPLETED' ? 'COMPLETED' : 'REVIEWED' },
    });
  });

  await createActivityLog({
    companyId: auth.companyId,
    userId: auth.userId,
    contactId: deal.contactId,
    dealId: deal.id,
    eventType: status === 'COMPLETED' ? ACTIVITY_TYPES.CLIENT_ONBOARDING_COMPLETED : ACTIVITY_TYPES.CLIENT_ONBOARDING_REVIEW_STARTED,
    metadata: { formName: TEMPLATE_NAME, submissionId: submission.id, status },
  });

  return getDealOnboardingPanel(auth, dealId);
}

export async function updateDealOnboardingFromPublicView(input: { companyId: string; formSystemKey?: string | null; dealId?: string | null }) {
  if (input.formSystemKey !== CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY || !input.dealId) return;
  const result = await prisma.deal.updateMany({
    where: { id: input.dealId, companyId: input.companyId, onboardingStatus: { in: ['LINK_CREATED', 'SENT'] } },
    data: { onboardingStatus: 'IN_PROGRESS' },
  });
  if (result.count > 0) {
    await createActivityLog({
      companyId: input.companyId,
      dealId: input.dealId,
      eventType: ACTIVITY_TYPES.CLIENT_ONBOARDING_FORM_OPENED,
      metadata: { formName: TEMPLATE_NAME, status: 'IN_PROGRESS' },
    });
  }
}

export async function updateDealOnboardingFromSubmission(input: { companyId: string; formSystemKey?: string | null; dealId?: string | null; contactId?: string | null; submissionId: string }) {
  if (input.formSystemKey !== CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY || !input.dealId) return;
  await prisma.deal.updateMany({
    where: { id: input.dealId, companyId: input.companyId },
    data: { onboardingStatus: 'SUBMITTED' },
  });
  await createActivityLog({
    companyId: input.companyId,
    contactId: input.contactId,
    dealId: input.dealId,
    eventType: ACTIVITY_TYPES.CLIENT_ONBOARDING_SUBMITTED,
    metadata: { formName: TEMPLATE_NAME, submissionId: input.submissionId, status: 'SUBMITTED' },
  });

  const submission = await prisma.formSubmission.findFirst({
    where: { id: input.submissionId, companyId: input.companyId },
    include: {
      contact: true,
      deal: { include: { assignedTo: { select: { email: true, firstName: true, lastName: true } } } },
      company: { select: { name: true, email: true } },
    },
  });
  if (!submission) return;

  const admins = await prisma.user.findMany({
    where: { companyId: input.companyId, status: 'ACTIVE', role: { in: ['ADMIN', 'MANAGER'] } },
    select: { email: true, firstName: true, lastName: true },
    take: 10,
  });
  const recipients = new Map<string, { email: string; firstName?: string | null; lastName?: string | null }>();
  [...admins, submission.deal?.assignedTo].forEach((user) => {
    if (user?.email) recipients.set(user.email, user);
  });

  await Promise.all(
    Array.from(recipients.values()).map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject: `Client onboarding submitted - ${submission.deal?.title || TEMPLATE_NAME}`,
        html: `
          <div style="font-family:Arial,sans-serif;color:#10201d;line-height:1.6;">
            <h2 style="color:#004741;">Client onboarding submitted</h2>
            <p>${escapeHtml(contactDisplayName(submission.contact || { firstName: 'Client' }))} submitted the onboarding form.</p>
            <p><strong>Deal:</strong> ${escapeHtml(submission.deal?.title || 'Not linked')}</p>
            <p><strong>Submitted:</strong> ${escapeHtml(submission.submittedAt.toISOString())}</p>
            <p>Open LeadFlow to review the grouped answers and move the onboarding to review.</p>
          </div>
        `,
        text: `Client onboarding submitted\nDeal: ${submission.deal?.title || 'Not linked'}\nSubmitted: ${submission.submittedAt.toISOString()}`,
      }).catch((error) => {
        logger.warn({ error, recipient: recipient.email }, 'Client onboarding internal notification failed');
      }),
    ),
  );
}

export async function sendClientOnboardingLink(input: { companyId: string; dealId: string; contactId: string; url: string }) {
  logger.info({
    event: 'CLIENT_ONBOARDING_LINK_READY',
    companyId: input.companyId,
    dealId: input.dealId,
    contactId: input.contactId,
    previewUrlAvailable: Boolean(input.url),
  });
}

export async function processClientOnboardingReminders(auth: AuthPayload, now = new Date()) {
  assertCanManageOnboarding(auth);
  assertCode2CrestTenant(auth);
  return processClientOnboardingRemindersForCompany(auth.companyId, now, auth.userId);
}

export async function processClientOnboardingRemindersForCompany(companyId = code2crestCompanyId(), now = new Date(), actorUserId?: string | null) {
  const template = await findTemplate(companyId);
  if (!template) return { processed: 0, sent: 0 };

  const actor =
    actorUserId ||
    (
      await prisma.user.findFirst({
        where: { companyId, status: 'ACTIVE', role: { in: ['ADMIN', 'MANAGER'] } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, email: true, role: true },
      })
    )?.id;
  if (!actor) {
    throw new ClientOnboardingError(409, 'ONBOARDING_REMINDER_ACTOR_MISSING', 'No active Code2Crest admin or manager was found for reminder automation');
  }

  const systemAuth: AuthPayload = {
    userId: actor,
    companyId,
    email: 'automation@leadflow.local',
    role: 'ADMIN',
  };

  const sentDeals = await prisma.deal.findMany({
    where: { companyId, onboardingStatus: { in: ['SENT', 'IN_PROGRESS'] } },
    include: {
      contact: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      activityLogs: {
        where: { eventType: { in: [ACTIVITY_TYPES.CLIENT_ONBOARDING_SENT, ACTIVITY_TYPES.CLIENT_ONBOARDING_EMAIL_SENT, ACTIVITY_TYPES.CLIENT_ONBOARDING_REMINDER_SENT] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  let sent = 0;
  for (const deal of sentDeals) {
    const alreadySubmitted = await prisma.formSubmission.findFirst({
      where: { companyId, dealId: deal.id, formId: template.id },
      select: { id: true },
    });
    if (alreadySubmitted || !deal.contact.email) continue;

    const sentAt = deal.activityLogs[0]?.createdAt || deal.updatedAt;
    const ageDays = Math.floor((now.getTime() - sentAt.getTime()) / (24 * 60 * 60 * 1000));
    const existingReminders = await prisma.clientOnboardingReminder.findMany({
      where: { companyId, dealId: deal.id },
      select: { reminderDay: true },
    });
    const sentReminderDays = new Set(existingReminders.map((reminder) => reminder.reminderDay));
    const reminderDay = REMINDER_DAYS.find((day) => ageDays >= day && !sentReminderDays.has(day));
    if (!reminderDay) continue;

    const link = await createFreshOnboardingToken(systemAuth, deal, template.id, ACTIVITY_TYPES.CLIENT_ONBOARDING_LINK_REGENERATED);
    const email = buildClientOnboardingEmail({
      clientName: contactDisplayName(deal.contact),
      companyName: deal.contact.companyName,
      projectName: deal.title,
      onboardingUrl: link.url,
      expiresAt: link.expiresAt,
      reminder: true,
    });
    const delivery = await sendEmail({ to: deal.contact.email, subject: email.subject, html: email.html, text: email.text });
    await prisma.clientOnboardingReminder.create({
      data: {
        companyId,
        dealId: deal.id,
        contactId: deal.contactId,
        publicFormTokenId: link.id,
        reminderDay,
        metadata: { provider: delivery.provider, sent: delivery.sent, emailId: delivery.id ?? null },
      },
    });
    await createActivityLog({
      companyId,
      userId: actor,
      contactId: deal.contactId,
      dealId: deal.id,
      eventType: ACTIVITY_TYPES.CLIENT_ONBOARDING_REMINDER_SENT,
      metadata: { formName: TEMPLATE_NAME, reminderDay, status: 'SENT', provider: delivery.provider, sent: delivery.sent },
    });
    sent += 1;
  }

  return { processed: sentDeals.length, sent };
}

export async function getClientOnboardingMetrics(auth: AuthPayload) {
  assertCode2CrestTenant(auth);
  const [sent, inProgress, submitted, completed, reminders, completedDeals] = await Promise.all([
    prisma.deal.count({ where: { companyId: auth.companyId, onboardingStatus: 'SENT' } }),
    prisma.deal.count({ where: { companyId: auth.companyId, onboardingStatus: 'IN_PROGRESS' } }),
    prisma.deal.count({ where: { companyId: auth.companyId, onboardingStatus: 'SUBMITTED' } }),
    prisma.deal.count({ where: { companyId: auth.companyId, onboardingStatus: 'COMPLETED' } }),
    prisma.clientOnboardingReminder.count({ where: { companyId: auth.companyId } }),
    prisma.deal.findMany({
      where: { companyId: auth.companyId, onboardingStatus: 'COMPLETED' },
      select: {
        id: true,
        activityLogs: {
          where: { eventType: { in: [ACTIVITY_TYPES.CLIENT_ONBOARDING_SENT, ACTIVITY_TYPES.CLIENT_ONBOARDING_COMPLETED] } },
          select: { eventType: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      take: 100,
    }),
  ]);

  const completionHours = completedDeals
    .map((deal) => {
      const start = deal.activityLogs.find((log) => log.eventType === ACTIVITY_TYPES.CLIENT_ONBOARDING_SENT)?.createdAt;
      const end = deal.activityLogs.find((log) => log.eventType === ACTIVITY_TYPES.CLIENT_ONBOARDING_COMPLETED)?.createdAt;
      return start && end ? (end.getTime() - start.getTime()) / (60 * 60 * 1000) : null;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const total = sent + inProgress + submitted + completed;

  return {
    sent,
    inProgress,
    submitted,
    completed,
    reminderCount: reminders,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    averageCompletionHours: completionHours.length
      ? Math.round(completionHours.reduce((sum, value) => sum + value, 0) / completionHours.length)
      : null,
  };
}
