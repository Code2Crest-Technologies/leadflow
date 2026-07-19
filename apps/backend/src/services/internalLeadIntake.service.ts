import crypto from 'crypto';
import type { Contact, Prisma, User } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { OPEN_DEAL_STAGES } from '../constants/dealStages.js';
import { LEAD_SOURCES } from '../constants/leadSources.js';
import { createActivityLog } from './activityLog.service.js';

const attributionSchema = z
  .object({
    utmSource: z.string().trim().max(200).optional().or(z.literal('')),
    utmMedium: z.string().trim().max(200).optional().or(z.literal('')),
    utmCampaign: z.string().trim().max(200).optional().or(z.literal('')),
    utmTerm: z.string().trim().max(200).optional().or(z.literal('')),
    utmContent: z.string().trim().max(200).optional().or(z.literal('')),
    referrer: z.string().trim().max(1000).optional().or(z.literal('')),
    landingPage: z.string().trim().max(1000).optional().or(z.literal('')),
    currentPage: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .optional();

export const internalLeadIntakeSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    companyName: z.string().trim().max(160).optional().or(z.literal('')),
    email: z.string().trim().email().max(254).optional().or(z.literal('')),
    phone: z.string().trim().max(40).optional().or(z.literal('')),
    service: z.string().trim().min(1).max(160),
    budget: z.string().trim().max(120).optional().or(z.literal('')),
    timeline: z.string().trim().max(120).optional().or(z.literal('')),
    projectDescription: z.string().trim().max(4000).optional().or(z.literal('')),
    heardAboutUs: z.string().trim().max(160).optional().or(z.literal('')),
    attribution: attributionSchema,
  })
  .superRefine((payload, context) => {
    if (!emptyToNull(payload.email) && !emptyToNull(payload.phone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email or phone is required',
        path: ['email'],
      });
    }
  });

export type InternalLeadIntakePayload = z.infer<typeof internalLeadIntakeSchema>;

export class InternalLeadIntakeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface IntakeResult {
  contactId: string;
  dealId: string;
  duplicateReused: boolean;
}

function emptyToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value?: string | null) {
  return emptyToNull(value)?.toLowerCase() ?? null;
}

function normalizePhone(value?: string | null) {
  const trimmed = emptyToNull(value);
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\d+]/g, '');
  return normalized || null;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function emailPhoneFallback(email: string) {
  return `email:${crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)}`;
}

function toJsonObject(value: Prisma.JsonValue | null | undefined): Prisma.InputJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Prisma.InputJsonObject;
}

function attributionToJson(attribution: InternalLeadIntakePayload['attribution']) {
  const result: Record<string, Prisma.InputJsonValue> = {};
  if (!attribution) return result;

  Object.entries(attribution).forEach(([key, value]) => {
    const normalized = emptyToNull(value);
    if (normalized) result[key] = normalized;
  });

  return result;
}

function buildDealTitle(payload: InternalLeadIntakePayload) {
  const leadName = emptyToNull(payload.companyName) || payload.name;
  return `${leadName} - ${payload.service}`;
}

function buildDealDescription(payload: InternalLeadIntakePayload) {
  const attribution = payload.attribution;
  const lines = [
    `Source: ${LEAD_SOURCES.CODE2CREST_GET_QUOTE}`,
    `Name: ${payload.name}`,
    emptyToNull(payload.companyName) ? `Company: ${payload.companyName}` : null,
    normalizeEmail(payload.email) ? `Email: ${normalizeEmail(payload.email)}` : null,
    normalizePhone(payload.phone) ? `Phone: ${normalizePhone(payload.phone)}` : null,
    `Service: ${payload.service}`,
    emptyToNull(payload.budget) ? `Budget: ${payload.budget}` : null,
    emptyToNull(payload.timeline) ? `Timeline: ${payload.timeline}` : null,
    emptyToNull(payload.heardAboutUs) ? `Heard about us: ${payload.heardAboutUs}` : null,
    emptyToNull(payload.projectDescription) ? `Project description: ${payload.projectDescription}` : null,
    emptyToNull(attribution?.utmSource) ? `UTM source: ${attribution?.utmSource}` : null,
    emptyToNull(attribution?.utmMedium) ? `UTM medium: ${attribution?.utmMedium}` : null,
    emptyToNull(attribution?.utmCampaign) ? `UTM campaign: ${attribution?.utmCampaign}` : null,
    emptyToNull(attribution?.utmTerm) ? `UTM term: ${attribution?.utmTerm}` : null,
    emptyToNull(attribution?.utmContent) ? `UTM content: ${attribution?.utmContent}` : null,
    emptyToNull(attribution?.referrer) ? `Referrer: ${attribution?.referrer}` : null,
    emptyToNull(attribution?.landingPage) ? `Landing page: ${attribution?.landingPage}` : null,
    emptyToNull(attribution?.currentPage) ? `Current page: ${attribution?.currentPage}` : null,
  ];

  return lines.filter(Boolean).join('\n');
}

async function resolveCode2CrestCompany() {
  const companyId = emptyToNull(process.env.CODE2CREST_LEADFLOW_COMPANY_ID);
  if (!companyId) {
    throw new InternalLeadIntakeError(
      503,
      'LEADFLOW_COMPANY_NOT_CONFIGURED',
      'Lead intake company is not configured',
    );
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new InternalLeadIntakeError(503, 'LEADFLOW_COMPANY_NOT_FOUND', 'Lead intake company not found');
  }

  return company;
}

async function resolveAssignee(companyId: string): Promise<User> {
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (admin) return admin;

  const manager = await prisma.user.findFirst({
    where: { companyId, role: 'MANAGER', status: 'ACTIVE', deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (manager) return manager;

  const user = await prisma.user.findFirst({
    where: { companyId, status: 'ACTIVE', deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) {
    throw new InternalLeadIntakeError(503, 'LEADFLOW_ASSIGNEE_NOT_FOUND', 'No active LeadFlow user found');
  }

  return user;
}

async function findExistingContact(companyId: string, email: string | null, phone: string | null) {
  if (email) {
    const contactByEmail = await prisma.contact.findFirst({
      where: { companyId, email },
      orderBy: { updatedAt: 'desc' },
    });
    if (contactByEmail) return contactByEmail;
  }

  if (phone) {
    return prisma.contact.findFirst({
      where: { companyId, phoneNumber: phone },
      orderBy: { updatedAt: 'desc' },
    });
  }

  return null;
}

async function upsertContact(companyId: string, payload: InternalLeadIntakePayload) {
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const existing = await findExistingContact(companyId, email, phone);
  const { firstName, lastName } = splitName(payload.name);
  const companyName = emptyToNull(payload.companyName);
  const contactPersonName = companyName ? payload.name : null;
  const customFields: Prisma.InputJsonObject = {
    ...(existing ? toJsonObject(existing.customFields) : {}),
    source: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
    leadSource: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
    service: payload.service,
    budget: emptyToNull(payload.budget),
    timeline: emptyToNull(payload.timeline),
    heardAboutUs: emptyToNull(payload.heardAboutUs),
    attribution: attributionToJson(payload.attribution),
  };

  if (existing) {
    const updateData: Prisma.ContactUpdateInput = {
      customFields,
      segment: existing.segment === 'CUSTOMER' || existing.segment === 'VIP' ? existing.segment : 'LEAD',
    };

    if (email && !existing.email) updateData.email = email;
    if (phone && (!existing.phoneNumber || existing.phoneNumber.startsWith('email:'))) {
      updateData.phoneNumber = phone;
    }
    if (companyName && !existing.companyName) updateData.companyName = companyName;
    if (contactPersonName && !existing.contactPersonName) updateData.contactPersonName = contactPersonName;
    if (!existing.lastName && lastName) updateData.lastName = lastName;
    if (!existing.firstName) updateData.firstName = firstName;

    return prisma.contact.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  return prisma.contact.create({
    data: {
      companyId,
      phoneNumber: phone || emailPhoneFallback(email!),
      phoneCountryCode: phone?.startsWith('+') ? null : '+91',
      email,
      firstName,
      lastName,
      contactType: companyName ? 'COMPANY' : 'PERSON',
      companyName,
      contactPersonName,
      country: 'India',
      segment: 'LEAD',
      status: 'ACTIVE',
      customFields,
      metaLeadData: {
        source: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
        service: payload.service,
        attribution: attributionToJson(payload.attribution),
      },
    },
  });
}

async function findRecentDuplicateDeal(companyId: string, contactId: string, service: string) {
  const duplicateWindowStart = new Date(Date.now() - 30 * 60 * 1000);

  return prisma.deal.findFirst({
    where: {
      companyId,
      contactId,
      source: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
      stage: { in: [...OPEN_DEAL_STAGES] },
      createdAt: { gte: duplicateWindowStart },
      title: { contains: service },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function upsertDeal(companyId: string, contact: Contact, assignee: User, payload: InternalLeadIntakePayload) {
  const title = buildDealTitle(payload);
  const description = buildDealDescription(payload);
  const duplicate = await findRecentDuplicateDeal(companyId, contact.id, payload.service);

  if (duplicate) {
    const deal = await prisma.deal.update({
      where: { id: duplicate.id },
      data: {
        title,
        description,
        assignedToId: duplicate.assignedToId || assignee.id,
      },
    });

    return { deal, duplicateReused: true };
  }

  const deal = await prisma.deal.create({
    data: {
      companyId,
      contactId: contact.id,
      assignedToId: assignee.id,
      title,
      description,
      value: 0,
      currency: 'INR',
      stage: 'PROSPECT',
      probability: 10,
      source: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
    },
  });

  return { deal, duplicateReused: false };
}

function activityMetadata(payload: InternalLeadIntakePayload): Prisma.InputJsonObject {
  return {
    source: LEAD_SOURCES.CODE2CREST_GET_QUOTE,
    service: payload.service,
    budget: emptyToNull(payload.budget),
    timeline: emptyToNull(payload.timeline),
    utmSource: emptyToNull(payload.attribution?.utmSource),
    utmCampaign: emptyToNull(payload.attribution?.utmCampaign),
  };
}

export async function intakeCode2CrestLead(rawPayload: unknown): Promise<IntakeResult> {
  const payload = internalLeadIntakeSchema.parse(rawPayload);
  const company = await resolveCode2CrestCompany();
  const assignee = await resolveAssignee(company.id);
  const contact = await upsertContact(company.id, payload);
  const { deal, duplicateReused } = await upsertDeal(company.id, contact, assignee, payload);

  await createActivityLog({
    companyId: company.id,
    eventType: ACTIVITY_TYPES.WEBSITE_LEAD_CAPTURED,
    contactId: contact.id,
    dealId: deal.id,
    userId: assignee.id,
    metadata: activityMetadata(payload),
  });

  return {
    contactId: contact.id,
    dealId: deal.id,
    duplicateReused,
  };
}
