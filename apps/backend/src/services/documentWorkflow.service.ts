import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { z } from 'zod';
import type { DocumentStatus, DocumentType, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import type { AuthPayload } from '../types/index.js';
import { createActivityLog } from './activityLog.service.js';
import { sendEmail } from './email.service.js';

export class DocumentWorkflowError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = 'DOCUMENT_WORKFLOW_ERROR',
  ) {
    super(message);
  }
}

const documentTypes = [
  'PROPOSAL',
  'STATEMENT_OF_WORK',
  'SERVICE_AGREEMENT',
  'NDA',
  'MAINTENANCE_AGREEMENT',
  'SAAS_SUBSCRIPTION_AGREEMENT',
  'CUSTOM',
] as const;

export const createDocumentSchema = z.object({
  dealId: z.string().optional(),
  projectId: z.string().optional(),
  templateId: z.string().optional(),
  type: z.enum(documentTypes),
  title: z.string().trim().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).optional(),
  renderedContent: z.string().trim().min(1).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const createRevisionSchema = z.object({
  renderedContent: z.string().trim().min(1).optional(),
});

export const sendDocumentSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const rejectDocumentSchema = z.object({
  reason: z.string().trim().min(3),
  comments: z.string().trim().optional(),
});

export const acceptDocumentSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  designation: z.string().trim().optional(),
  confirmed: z.boolean().refine(Boolean),
});

export const templateSchema = z.object({
  name: z.string().trim().min(2),
  type: z.enum(documentTypes),
  description: z.string().optional(),
  content: z.string().trim().min(10),
});

export const documentQuerySchema = z.object({
  dealId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

const documentInclude = {
  contact: true,
  deal: { select: { id: true, title: true, stage: true, value: true, currency: true } },
  project: { select: { id: true, name: true, serviceType: true, status: true, startDate: true, targetDate: true } },
  template: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  currentVersion: true,
  versions: { orderBy: { versionNumber: 'desc' as const } },
  publicTokens: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  acceptances: { orderBy: { acceptedAt: 'desc' as const } },
};

const defaultTemplates: Array<{ name: string; type: DocumentType; description: string; content: string }> = [
  {
    name: 'Code2Crest Proposal',
    type: 'PROPOSAL',
    description: 'Generic proposal template for Code2Crest service opportunities.',
    content: `<h1>Proposal for {{client_name}}</h1>
<p>Dear {{client_name}},</p>
<p>Thank you for considering {{company_name}} for <strong>{{project_name}}</strong>.</p>
<h2>Scope Overview</h2>
<p>We propose to deliver {{service_type}} for {{deal_title}} with a commercial value of {{quotation_amount}}.</p>
<h2>Next Steps</h2>
<ul><li>Review this proposal.</li><li>Confirm scope and commercial terms.</li><li>Proceed to onboarding and kickoff.</li></ul>
<p>Regards,<br>{{company_name}}</p>`,
  },
  {
    name: 'Code2Crest Statement of Work',
    type: 'STATEMENT_OF_WORK',
    description: 'Lightweight SOW template for accepted projects.',
    content: `<h1>Statement of Work</h1>
<p>This Statement of Work is for <strong>{{project_name}}</strong>.</p>
<h2>Client</h2><p>{{client_name}}<br>{{client_email}}<br>{{client_phone}}</p>
<h2>Scope</h2><p>{{service_type}} for {{deal_title}}.</p>
<h2>Timeline</h2><p>Start: {{project_start_date}}<br>Target: {{project_target_date}}</p>
<h2>Commercials</h2><p>Quotation: {{quotation_number}}<br>Amount: {{quotation_amount}}<br>Payment Terms: {{payment_terms}}</p>`,
  },
  {
    name: 'Code2Crest Service Agreement',
    type: 'SERVICE_AGREEMENT',
    description: 'Generic service agreement template requiring legal review.',
    content: `<h1>Service Agreement</h1>
<p>This agreement is between {{company_name}} and {{client_name}} for {{project_name}}.</p>
<p>The parties agree to collaborate in good faith on the services described in the approved proposal/SOW.</p>
<p>Payment terms: {{payment_terms}}.</p>
<p><em>Template disclaimer: This document should be reviewed by qualified legal counsel before production use.</em></p>`,
  },
  {
    name: 'Code2Crest NDA',
    type: 'NDA',
    description: 'Generic mutual confidentiality template.',
    content: `<h1>Non-Disclosure Agreement</h1>
<p>{{company_name}} and {{client_name}} may exchange confidential information related to {{project_name}}.</p>
<p>Both parties agree to keep confidential information private and use it only for evaluating or delivering the project.</p>
<p><em>This template is not legal advice.</em></p>`,
  },
  {
    name: 'Code2Crest Maintenance Agreement',
    type: 'MAINTENANCE_AGREEMENT',
    description: 'Maintenance and support agreement template.',
    content: `<h1>Maintenance Agreement</h1>
<p>{{company_name}} will provide maintenance support for {{client_name}} related to {{project_name}}.</p>
<p>Service type: {{service_type}}.</p>
<p>Commercial reference: {{quotation_number}} - {{quotation_amount}}.</p>`,
  },
  {
    name: 'Code2Crest SaaS Subscription Agreement',
    type: 'SAAS_SUBSCRIPTION_AGREEMENT',
    description: 'SaaS subscription agreement template.',
    content: `<h1>SaaS Subscription Agreement</h1>
<p>This subscription agreement covers access to {{project_name}} for {{client_name}}.</p>
<p>Subscription and commercial terms are governed by the accepted quotation and agreed service schedule.</p>
<p><em>This template should be reviewed by qualified legal counsel.</em></p>`,
  },
];

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function frontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function reviewUrl(token: string) {
  return `${frontendUrl()}/public/documents/${token}`;
}

function canManageDocuments(auth: AuthPayload) {
  return auth.role === 'ADMIN' || auth.role === 'MANAGER' || auth.role === 'AGENT';
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeDocumentHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function unresolvedVariables(content: string) {
  return Array.from(new Set((content.match(/{{\s*[\w.]+\s*}}/g) || []).map((item) => item.replace(/[{}]/g, '').trim())));
}

async function buildMergeContext(companyId: string, input: { dealId?: string | null; projectId?: string | null; contactId?: string | null }) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const project = input.projectId
    ? await prisma.project.findFirst({
        where: { id: input.projectId, companyId },
        include: { contact: true, deal: { include: { contact: true, project: true, quotations: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      })
    : null;
  const deal = input.dealId
    ? await prisma.deal.findFirst({
        where: { id: input.dealId, companyId },
        include: { contact: true, quotations: { orderBy: { createdAt: 'desc' }, take: 1 }, project: true },
      })
    : project?.deal || null;
  const contact = project?.contact || deal?.contact || (input.contactId ? await prisma.contact.findFirst({ where: { id: input.contactId, companyId } }) : null);
  const quotation = deal?.quotations?.[0] || null;

  if (!company || !contact) {
    throw new DocumentWorkflowError('Document requires a valid company and contact.', 404, 'DOCUMENT_SOURCE_NOT_FOUND');
  }

  const clientName =
    contact.contactType === 'COMPANY'
      ? contact.companyName || contact.contactPersonName || contact.firstName
      : `${contact.firstName} ${contact.lastName || ''}`.trim();

  const variables: Record<string, string> = {
    client_name: clientName,
    client_company: contact.companyName || '',
    client_email: contact.email || '',
    client_phone: `${contact.phoneCountryCode || ''} ${contact.phoneNumber}`.trim(),
    project_name: project?.name || deal?.title || 'Project',
    service_type: project?.serviceType || deal?.source || 'Service',
    deal_title: deal?.title || project?.name || 'Project',
    quotation_number: quotation?.quoteNumber || 'Not available',
    quotation_amount: quotation ? `${quotation.total.toString()} ${deal?.currency || 'INR'}` : deal ? `${deal.value.toString()} ${deal.currency}` : 'Not available',
    quotation_valid_until: '',
    project_start_date: project?.startDate ? project.startDate.toDateString() : 'To be confirmed',
    project_target_date: project?.targetDate ? project.targetDate.toDateString() : 'To be confirmed',
    payment_terms: quotation?.paymentTerms || 'On approval',
    company_name: company.name,
    company_email: company.email || '',
    company_website: company.website || '',
  };

  return { company, contact, deal, project, quotation, variables };
}

function renderTemplate(content: string, variables: Record<string, string>) {
  return sanitizeDocumentHtml(
    content.replace(/{{\s*([\w.]+)\s*}}/g, (match, key: string) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) return escapeHtml(variables[key]);
      return match;
    }),
  );
}

export async function ensureDefaultDocumentTemplates(auth: AuthPayload) {
  const created: string[] = [];
  for (const template of defaultTemplates) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { companyId: auth.companyId, type: template.type, isSystemTemplate: true },
    });
    if (!existing) {
      const record = await prisma.documentTemplate.create({
        data: {
          ...template,
          companyId: auth.companyId,
          createdById: auth.userId,
          isSystemTemplate: true,
        },
      });
      created.push(record.id);
    }
  }
  return created;
}

export async function listDocumentTemplates(auth: AuthPayload) {
  await ensureDefaultDocumentTemplates(auth);
  return prisma.documentTemplate.findMany({
    where: { companyId: auth.companyId },
    orderBy: [{ isSystemTemplate: 'desc' }, { name: 'asc' }],
  });
}

export async function createDocumentTemplate(auth: AuthPayload, payload: z.infer<typeof templateSchema>) {
  if (auth.role !== 'ADMIN') throw new DocumentWorkflowError('Only admins can manage document templates.', 403, 'DOCUMENT_TEMPLATE_FORBIDDEN');
  return prisma.documentTemplate.create({
    data: {
      ...payload,
      content: sanitizeDocumentHtml(payload.content),
      companyId: auth.companyId,
      createdById: auth.userId,
    },
  });
}

export async function updateDocumentTemplate(auth: AuthPayload, id: string, payload: z.infer<typeof templateSchema>) {
  if (auth.role !== 'ADMIN') throw new DocumentWorkflowError('Only admins can manage document templates.', 403, 'DOCUMENT_TEMPLATE_FORBIDDEN');
  const existing = await prisma.documentTemplate.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) throw new DocumentWorkflowError('Template not found.', 404, 'DOCUMENT_TEMPLATE_NOT_FOUND');
  if (existing.isSystemTemplate) throw new DocumentWorkflowError('Clone system templates before editing.', 409, 'DOCUMENT_SYSTEM_TEMPLATE_IMMUTABLE');
  return prisma.documentTemplate.update({
    where: { id: existing.id },
    data: { ...payload, content: sanitizeDocumentHtml(payload.content) },
  });
}

export async function cloneDocumentTemplate(auth: AuthPayload, id: string) {
  if (auth.role !== 'ADMIN') throw new DocumentWorkflowError('Only admins can clone document templates.', 403, 'DOCUMENT_TEMPLATE_FORBIDDEN');
  const existing = await prisma.documentTemplate.findFirst({ where: { id, companyId: auth.companyId } });
  if (!existing) throw new DocumentWorkflowError('Template not found.', 404, 'DOCUMENT_TEMPLATE_NOT_FOUND');
  return prisma.documentTemplate.create({
    data: {
      companyId: auth.companyId,
      name: `${existing.name} Copy`,
      type: existing.type,
      description: existing.description,
      content: existing.content,
      createdById: auth.userId,
    },
  });
}

export async function listDocuments(auth: AuthPayload, query: z.infer<typeof documentQuerySchema>) {
  return prisma.document.findMany({
    where: {
      companyId: auth.companyId,
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status as DocumentStatus } : {}),
      ...(query.type ? { type: query.type as DocumentType } : {}),
    },
    include: documentInclude,
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getDocument(auth: AuthPayload, id: string) {
  return prisma.document.findFirst({ where: { id, companyId: auth.companyId }, include: documentInclude });
}

async function resolveTemplate(auth: AuthPayload, type: DocumentType, templateId?: string) {
  await ensureDefaultDocumentTemplates(auth);
  const template = templateId
    ? await prisma.documentTemplate.findFirst({ where: { id: templateId, companyId: auth.companyId, isActive: true } })
    : await prisma.documentTemplate.findFirst({ where: { companyId: auth.companyId, type, isActive: true }, orderBy: { isSystemTemplate: 'desc' } });
  if (!template) throw new DocumentWorkflowError('Document template not found.', 404, 'DOCUMENT_TEMPLATE_NOT_FOUND');
  return template;
}

export async function createDocument(auth: AuthPayload, payload: z.infer<typeof createDocumentSchema>) {
  if (!canManageDocuments(auth)) throw new DocumentWorkflowError('Document access denied.', 403, 'DOCUMENT_FORBIDDEN');
  if (!payload.dealId && !payload.projectId) throw new DocumentWorkflowError('Document must be linked to a deal or project.', 400, 'DOCUMENT_LINK_REQUIRED');

  const template = await resolveTemplate(auth, payload.type, payload.templateId);
  const context = await buildMergeContext(auth.companyId, { dealId: payload.dealId, projectId: payload.projectId });
  const renderedContent = renderTemplate(template.content, context.variables);
  const title = payload.title || `${template.name} - ${context.variables.project_name}`;

  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        companyId: auth.companyId,
        dealId: context.deal?.id,
        projectId: context.project?.id || context.deal?.project?.id,
        contactId: context.contact.id,
        templateId: template.id,
        type: payload.type,
        title,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
        createdById: auth.userId,
      },
    });
    const version = await tx.documentVersion.create({
      data: {
        documentId: created.id,
        versionNumber: 1,
        renderedContent,
        sourceSnapshot: {
          variables: context.variables,
          templateId: template.id,
          quotationId: context.quotation?.id,
          dealId: context.deal?.id,
          projectId: context.project?.id,
        } as Prisma.InputJsonValue,
        createdById: auth.userId,
      },
    });
    await tx.document.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.DOCUMENT_CREATED,
        contactId: context.contact.id,
        dealId: context.deal?.id,
        projectId: context.project?.id,
        documentId: created.id,
        userId: auth.userId,
        metadata: { title, type: payload.type, versionNumber: 1 },
      },
      tx,
    );
    return created;
  });

  return getDocument(auth, document.id);
}

export async function updateDraftDocument(auth: AuthPayload, id: string, payload: z.infer<typeof updateDocumentSchema>) {
  const document = await getDocument(auth, id);
  if (!document) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  if (!['DRAFT', 'READY'].includes(document.status)) {
    throw new DocumentWorkflowError('Create a revision to edit a sent/viewed/accepted document.', 409, 'DOCUMENT_VERSION_IMMUTABLE');
  }
  const content = payload.renderedContent ? sanitizeDocumentHtml(payload.renderedContent) : undefined;
  if (content && document.currentVersionId) {
    await prisma.documentVersion.update({ where: { id: document.currentVersionId }, data: { renderedContent: content } });
  }
  await prisma.document.update({
    where: { id },
    data: {
      title: payload.title,
      status: content ? 'DRAFT' : undefined,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : payload.expiresAt === null ? null : undefined,
    },
  });
  return getDocument(auth, id);
}

export async function createDocumentRevision(auth: AuthPayload, id: string, payload: z.infer<typeof createRevisionSchema>) {
  const document = await getDocument(auth, id);
  if (!document?.currentVersion) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  const nextVersion = Math.max(...document.versions.map((version) => version.versionNumber)) + 1;
  const content = sanitizeDocumentHtml(payload.renderedContent || document.currentVersion.renderedContent);
  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: nextVersion,
      renderedContent: content,
      sourceSnapshot: document.currentVersion.sourceSnapshot as Prisma.InputJsonValue,
      createdById: auth.userId,
    },
  });
  await prisma.documentPublicToken.updateMany({ where: { documentId: document.id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
  await prisma.document.update({ where: { id: document.id }, data: { currentVersionId: version.id, status: 'DRAFT', supersededAt: new Date() } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_REVISION_CREATED,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
    metadata: { versionNumber: nextVersion },
  });
  return getDocument(auth, id);
}

export async function markDocumentReady(auth: AuthPayload, id: string) {
  const document = await getDocument(auth, id);
  if (!document?.currentVersion) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  const blockers: string[] = [];
  if (!document.title.trim()) blockers.push('Document title is required.');
  if (!document.currentVersion.renderedContent.trim()) blockers.push('Document content is required.');
  const unresolved = unresolvedVariables(document.currentVersion.renderedContent);
  if (unresolved.length) blockers.push(`Unresolved merge variables: ${unresolved.join(', ')}`);
  if (blockers.length) throw new DocumentWorkflowError(blockers.join(' '), 400, 'DOCUMENT_READY_BLOCKED');

  const updated = await prisma.document.update({ where: { id: document.id }, data: { status: 'READY' } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_MARKED_READY,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
    metadata: { title: document.title },
  });
  return getDocument(auth, updated.id);
}

export async function createDocumentPublicLink(auth: AuthPayload, id: string, expiresAt?: string) {
  const document = await getDocument(auth, id);
  if (!document?.currentVersion) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  if (!['READY', 'SENT', 'VIEWED'].includes(document.status)) {
    throw new DocumentWorkflowError('Document must be marked ready before sharing.', 409, 'DOCUMENT_NOT_READY');
  }
  await prisma.documentPublicToken.updateMany({ where: { documentId: document.id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
  const token = generateToken();
  const expiry = expiresAt ? new Date(expiresAt) : document.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const record = await prisma.documentPublicToken.create({
    data: {
      documentId: document.id,
      versionId: document.currentVersion.id,
      tokenHash: hashToken(token),
      expiresAt: expiry,
    },
  });
  await prisma.document.update({ where: { id: document.id }, data: { expiresAt: expiry } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_LINK_REGENERATED,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
    metadata: { tokenId: record.id, expiresAt: expiry.toISOString() },
  });
  return { token, url: reviewUrl(token), expiresAt: expiry };
}

export async function sendDocumentToClient(auth: AuthPayload, id: string, payload: z.infer<typeof sendDocumentSchema>) {
  const document = await getDocument(auth, id);
  if (!document?.currentVersion) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  if (document.status !== 'READY') throw new DocumentWorkflowError('Mark document ready before sending.', 409, 'DOCUMENT_NOT_READY');
  if (!document.contact.email) throw new DocumentWorkflowError('Client email is required before sending.', 400, 'DOCUMENT_CLIENT_EMAIL_REQUIRED');

  const link = await createDocumentPublicLink(auth, id, payload.expiresAt);
  const email = await sendEmail({
    to: document.contact.email,
    subject: `${document.title} - Code2Crest Technologies`,
    html: `<p>Hello ${escapeHtml(document.contact.firstName)},</p>
      <p>Please review <strong>${escapeHtml(document.title)}</strong>.</p>
      <p><a href="${link.url}" style="display:inline-block;padding:12px 18px;background:#004741;color:#fff;text-decoration:none;border-radius:10px;">Review Document</a></p>
      <p>This secure link expires on ${link.expiresAt.toDateString()}.</p>
      <p>Regards,<br>Code2Crest Technologies</p>`,
    text: `Please review ${document.title}: ${link.url}`,
  });

  if (!email.sent) throw new DocumentWorkflowError('Email provider is not configured, document was not marked sent.', 503, 'DOCUMENT_EMAIL_DISABLED');

  await prisma.document.update({ where: { id: document.id }, data: { status: 'SENT', sentAt: new Date(), expiresAt: link.expiresAt } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_SENT,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
    metadata: { emailId: email.id, expiresAt: link.expiresAt.toISOString() },
  });
  return { document: await getDocument(auth, id), link };
}

async function getValidPublicToken(token: string) {
  const record = await prisma.documentPublicToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      document: { include: { company: true, contact: true, project: true, deal: true, currentVersion: true, acceptances: true } },
      version: true,
    },
  });
  if (!record || record.invalidatedAt) throw new DocumentWorkflowError('Document link is invalid.', 404, 'DOCUMENT_LINK_INVALID');
  if (record.expiresAt && record.expiresAt < new Date()) {
    if (!['ACCEPTED', 'CANCELLED'].includes(record.document.status)) {
      await prisma.document.update({ where: { id: record.documentId }, data: { status: 'EXPIRED' } });
    }
    throw new DocumentWorkflowError('This document link has expired.', 410, 'DOCUMENT_LINK_EXPIRED');
  }
  if (record.maxUses && record.viewCount >= record.maxUses) throw new DocumentWorkflowError('Document link usage limit reached.', 410, 'DOCUMENT_LINK_USED');
  if (record.document.currentVersionId !== record.versionId) throw new DocumentWorkflowError('This document version has been superseded.', 409, 'DOCUMENT_VERSION_SUPERSEDED');
  return record;
}

export async function getPublicDocument(token: string) {
  const record = await getValidPublicToken(token);
  const firstView = !record.document.viewedAt;
  await prisma.documentPublicToken.update({
    where: { id: record.id },
    data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
  });
  if (['SENT'].includes(record.document.status)) {
    await prisma.document.update({ where: { id: record.documentId }, data: { status: 'VIEWED', viewedAt: new Date() } });
  }
  if (firstView) {
    await createActivityLog({
      companyId: record.document.companyId,
      eventType: ACTIVITY_TYPES.DOCUMENT_VIEWED,
      contactId: record.document.contactId,
      dealId: record.document.dealId,
      projectId: record.document.projectId,
      documentId: record.document.id,
      metadata: { versionId: record.versionId },
    });
  }
  return {
    document: {
      title: record.document.title,
      type: record.document.type,
      status: record.document.status === 'SENT' ? 'VIEWED' : record.document.status,
      expiresAt: record.expiresAt,
      generatedAt: record.version.createdAt,
    },
    company: { name: record.document.company.name, logoUrl: record.document.company.logoUrl, email: record.document.company.email, website: record.document.company.website },
    client: { name: record.document.contact.companyName || `${record.document.contact.firstName} ${record.document.contact.lastName || ''}`.trim(), email: record.document.contact.email },
    project: record.document.project,
    deal: record.document.deal,
    version: { id: record.version.id, versionNumber: record.version.versionNumber, renderedContent: record.version.renderedContent },
    acceptance: record.document.acceptances[0] || null,
  };
}

export async function acceptPublicDocument(token: string, payload: z.infer<typeof acceptDocumentSchema>, userAgent?: string) {
  const record = await getValidPublicToken(token);
  if (!['SENT', 'VIEWED', 'READY'].includes(record.document.status)) {
    throw new DocumentWorkflowError('Document cannot be accepted in its current status.', 409, 'DOCUMENT_ACCEPT_NOT_ALLOWED');
  }
  const acceptanceText = 'I confirm that I have reviewed and accept this document.';
  const acceptance = await prisma.documentAcceptance.upsert({
    where: { documentId_versionId: { documentId: record.documentId, versionId: record.versionId } },
    create: {
      documentId: record.documentId,
      versionId: record.versionId,
      contactId: record.document.contactId,
      acceptedByName: payload.fullName,
      acceptedByEmail: payload.email,
      designation: payload.designation,
      acceptanceText,
      userAgent,
    },
    update: {},
  });
  await prisma.document.update({ where: { id: record.documentId }, data: { status: 'ACCEPTED', acceptedAt: acceptance.acceptedAt } });
  await prisma.documentPublicToken.updateMany({ where: { documentId: record.documentId, id: { not: record.id } }, data: { invalidatedAt: new Date() } });
  await createActivityLog({
    companyId: record.document.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_ACCEPTED,
    contactId: record.document.contactId,
    dealId: record.document.dealId,
    projectId: record.document.projectId,
    documentId: record.document.id,
    metadata: { acceptedByName: payload.fullName, acceptedByEmail: payload.email, versionId: record.versionId },
  });
  return acceptance;
}

export async function rejectPublicDocument(token: string, payload: z.infer<typeof rejectDocumentSchema>) {
  const record = await getValidPublicToken(token);
  if (!['SENT', 'VIEWED', 'READY'].includes(record.document.status)) {
    throw new DocumentWorkflowError('Document cannot be rejected in its current status.', 409, 'DOCUMENT_REJECT_NOT_ALLOWED');
  }
  await prisma.document.update({ where: { id: record.documentId }, data: { status: 'REJECTED', rejectedAt: new Date() } });
  await createActivityLog({
    companyId: record.document.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_REJECTED,
    contactId: record.document.contactId,
    dealId: record.document.dealId,
    projectId: record.document.projectId,
    documentId: record.document.id,
    metadata: { reason: payload.reason, comments: payload.comments, versionId: record.versionId },
  });
  return { rejected: true };
}

export async function cancelDocument(auth: AuthPayload, id: string) {
  const document = await getDocument(auth, id);
  if (!document) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  await prisma.documentPublicToken.updateMany({ where: { documentId: id, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
  await prisma.document.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_CANCELLED,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
  });
  return getDocument(auth, id);
}

export async function generateDocumentPdf(auth: AuthPayload, id: string) {
  const document = await getDocument(auth, id);
  if (!document?.currentVersion) throw new DocumentWorkflowError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.DOCUMENT_PDF_DOWNLOADED,
    contactId: document.contactId,
    dealId: document.dealId,
    projectId: document.projectId,
    documentId: document.id,
    userId: auth.userId,
  });
  return buildDocumentPdf(document);
}

export async function generatePublicDocumentPdf(token: string) {
  const record = await getValidPublicToken(token);
  return buildDocumentPdf({ ...record.document, currentVersion: record.version });
}

async function buildDocumentPdf(document: {
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  currentVersion: { versionNumber: number; renderedContent: string; createdAt: Date } | null;
  acceptances?: Array<{ acceptedByName: string; acceptedByEmail: string; acceptedAt: Date }>;
}) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 44;
  let y = 790;

  function draw(text: string, x: number, size = 10, useBold = false) {
    page.drawText(text.slice(0, 110), { x, y, size, font: useBold ? bold : font, color: rgb(0.06, 0.13, 0.11) });
    y -= size + 6;
  }

  function newPageIfNeeded(space = 40) {
    if (y < space) {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    }
  }

  draw('Code2Crest Technologies', margin, 13, true);
  draw(document.title, margin, 20, true);
  draw(`${document.type} | Version ${document.currentVersion?.versionNumber || 1} | ${document.status}`, margin, 10);
  y -= 10;

  const text = stripHtml(document.currentVersion?.renderedContent || '');
  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      if (`${line} ${word}`.length > 92) {
        newPageIfNeeded();
        draw(line, margin, 10);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    }
    if (line) {
      newPageIfNeeded();
      draw(line, margin, 10);
    }
    y -= 5;
  }

  const acceptance = document.acceptances?.[0];
  if (acceptance) {
    newPageIfNeeded(90);
    y -= 10;
    draw('Acceptance Summary', margin, 14, true);
    draw(`Accepted By: ${acceptance.acceptedByName}`, margin);
    draw(`Accepted Email: ${acceptance.acceptedByEmail}`, margin);
    draw(`Accepted Date: ${acceptance.acceptedAt.toISOString()}`, margin);
  }

  page.drawText('Code2Crest Technologies | Generated by LeadFlow', {
    x: margin,
    y: 28,
    size: 8,
    font,
    color: rgb(0.42, 0.48, 0.46),
  });
  return Buffer.from(await pdf.save());
}

export async function getAgreementReadiness(companyId: string, projectId?: string | null, dealId?: string | null) {
  const documents = await prisma.document.findMany({
    where: {
      companyId,
      OR: [{ projectId: projectId || undefined }, { dealId: dealId || undefined }],
      type: { in: ['SERVICE_AGREEMENT', 'STATEMENT_OF_WORK'] },
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (documents.some((document) => document.status === 'ACCEPTED')) {
    return { status: 'PASSED' as const, message: 'Accepted SOW or service agreement is linked.' };
  }
  if (documents.some((document) => document.status === 'REJECTED' || document.status === 'EXPIRED' || document.status === 'CANCELLED')) {
    return { status: 'FAILED' as const, message: 'Latest agreement/SOW requires revision or renewal.' };
  }
  if (documents.length) {
    return { status: 'WARNING' as const, message: 'Agreement/SOW exists but is not accepted yet.' };
  }
  return { status: 'WARNING' as const, message: 'Agreement/SOW is not accepted yet.' };
}
