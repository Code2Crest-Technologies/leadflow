import { z } from 'zod';
import type { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { ACTIVITY_TYPES } from '../constants/activityTypes.js';
import { createActivityLog } from './activityLog.service.js';
import { sendEmail } from './email.service.js';
import { getAgreementReadiness } from './documentWorkflow.service.js';
import { getAdvancePaymentReadiness } from './billing.service.js';
import type { AuthPayload } from '../types/index.js';

export class ProjectKickoffError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = 'PROJECT_KICKOFF_ERROR',
  ) {
    super(message);
  }
}

export const projectQuerySchema = z.object({
  status: z.string().optional(),
  serviceType: z.string().optional(),
  projectManagerId: z.string().optional(),
  search: z.string().optional(),
});

export const createProjectSchema = z.object({
  overrideReason: z.string().trim().min(8).optional(),
});

export const assignProjectSchema = z.object({
  ownerId: z.string().optional().nullable(),
  projectManagerId: z.string().optional().nullable(),
});

export const memberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['PROJECT_MANAGER', 'DEVELOPER', 'DESIGNER', 'QA', 'SALES', 'SUPPORT', 'OTHER']).default('OTHER'),
});

export const projectUpdateSchema = z.object({
  startDate: z.string().datetime().optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

export const statusTransitionSchema = z.object({
  status: z.enum(['READY_FOR_KICKOFF', 'ACTIVE', 'ON_HOLD', 'CLIENT_REVIEW', 'COMPLETED', 'CANCELLED']),
  reason: z.string().trim().min(5).optional(),
});

export type ReadinessStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_CONFIGURED';

export interface ReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  required: boolean;
  message: string;
}

const projectInclude = {
  contact: true,
  deal: { include: { quotations: { orderBy: { createdAt: 'desc' as const }, take: 1 } } },
  owner: { select: { id: true, firstName: true, lastName: true, email: true } },
  projectManager: { select: { id: true, firstName: true, lastName: true, email: true } },
  members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } } },
  documents: { include: { currentVersion: true }, orderBy: { updatedAt: 'desc' as const } },
  deliverables: { orderBy: { sortOrder: 'asc' as const } },
  milestones: { orderBy: { sortOrder: 'asc' as const } },
  requirements: { orderBy: { createdAt: 'asc' as const } },
  tasks: { orderBy: { dueDate: 'asc' as const }, include: { assignedTo: { select: { id: true, firstName: true, lastName: true } } } },
  activityLogs: { orderBy: { createdAt: 'desc' as const }, take: 50, include: { user: { select: { firstName: true, lastName: true } } } },
};

function canManageProjects(auth: AuthPayload) {
  return auth.role === 'ADMIN' || auth.role === 'MANAGER';
}

function canOverrideReadiness(auth: AuthPayload) {
  return auth.role === 'ADMIN';
}

function normalizeServiceType(value?: string | null) {
  const text = (value || '').toLowerCase();
  if (text.includes('maintenance') || text.includes('support')) return 'MAINTENANCE';
  if (text.includes('app') || text.includes('saas') || text.includes('software')) return 'WEB_APPLICATION';
  if (text.includes('website') || text.includes('web')) return 'WEBSITE';
  return 'GENERAL';
}

function formatAnswer(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

async function getLatestSubmission(companyId: string, dealId: string) {
  return prisma.formSubmission.findFirst({
    where: {
      companyId,
      dealId,
      form: { purpose: 'CLIENT_ONBOARDING' },
    },
    include: {
      values: {
        include: {
          field: true,
        },
      },
      form: true,
    },
    orderBy: { submittedAt: 'desc' },
  });
}

async function getDealForProject(auth: AuthPayload, dealId: string) {
  return prisma.deal.findFirst({
    where: { id: dealId, companyId: auth.companyId },
    include: {
      contact: true,
      project: true,
      quotations: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}

export async function getKickoffReadiness(auth: AuthPayload, dealId: string) {
  const deal = await getDealForProject(auth, dealId);
  const submission = await getLatestSubmission(auth.companyId, dealId);
  const agreementReadiness = await getAgreementReadiness(auth.companyId, deal?.project?.id, dealId);
  const advancePaymentReadiness = await getAdvancePaymentReadiness(auth.companyId, deal?.project?.id, dealId);

  const checks: ReadinessCheck[] = [
    {
      key: 'deal_exists',
      label: 'Deal exists',
      status: deal ? 'PASSED' : 'FAILED',
      required: true,
      message: deal ? 'Deal is available in this company.' : 'Deal was not found for this company.',
    },
    {
      key: 'deal_won',
      label: 'Deal Won',
      status: deal?.stage === 'WON' ? 'PASSED' : 'FAILED',
      required: true,
      message: deal?.stage === 'WON' ? 'Deal is marked WON.' : 'Deal must be moved to WON.',
    },
    {
      key: 'onboarding_completed',
      label: 'Client Onboarding Completed',
      status: deal?.onboardingStatus === 'COMPLETED' ? 'PASSED' : 'FAILED',
      required: true,
      message:
        deal?.onboardingStatus === 'COMPLETED'
          ? 'Client onboarding is completed.'
          : 'Client onboarding must be completed before kickoff.',
    },
    {
      key: 'onboarding_submission',
      label: 'Onboarding Submission',
      status: submission ? 'PASSED' : 'FAILED',
      required: true,
      message: submission ? 'Latest onboarding submission is available.' : 'No onboarding submission found.',
    },
    {
      key: 'contact',
      label: 'Client Contact Available',
      status: deal?.contact ? 'PASSED' : 'FAILED',
      required: true,
      message: deal?.contact ? 'Client contact is linked.' : 'Deal must have a linked contact.',
    },
    {
      key: 'quotation',
      label: 'Quotation Approval',
      status: deal?.quotations.some((quote) => quote.status === 'ACCEPTED') ? 'PASSED' : 'WARNING',
      required: false,
      message: deal?.quotations.some((quote) => quote.status === 'ACCEPTED')
        ? 'An accepted quotation is linked.'
        : 'No accepted quotation is linked yet.',
    },
    {
      key: 'agreement',
      label: 'Agreement / SOW',
      status: agreementReadiness.status,
      required: false,
      message: agreementReadiness.message,
    },
    {
      key: 'advance_payment',
      label: 'Advance Payment',
      status: advancePaymentReadiness.status,
      required: false,
      message: advancePaymentReadiness.message,
    },
  ];

  const blockers = checks.filter((check) => check.required && check.status === 'FAILED').map((check) => check.message);
  const warnings = checks
    .filter((check) => check.status === 'WARNING' || check.status === 'NOT_CONFIGURED')
    .map((check) => check.message);

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    checks,
    project: deal?.project || null,
  };
}

function buildBrief(deal: NonNullable<Awaited<ReturnType<typeof getDealForProject>>>, submission: NonNullable<Awaited<ReturnType<typeof getLatestSubmission>>>) {
  const answers = submission.values.map((item) => ({
    key: item.field.key,
    label: item.field.label,
    value: item.value,
    displayValue: formatAnswer(item.value),
  }));

  const answerByKey = new Map(answers.map((answer) => [answer.key.toLowerCase(), answer]));
  const find = (...keys: string[]) => keys.map((key) => answerByKey.get(key.toLowerCase())?.displayValue).find(Boolean) || '';

  const clientName =
    deal.contact.contactType === 'COMPANY'
      ? deal.contact.companyName || deal.contact.firstName
      : `${deal.contact.firstName} ${deal.contact.lastName || ''}`.trim();

  const data = {
    client: {
      name: clientName,
      company: deal.contact.companyName,
      email: deal.contact.email,
      phone: `${deal.contact.phoneCountryCode || ''} ${deal.contact.phoneNumber}`.trim(),
    },
    project: {
      name: deal.title,
      serviceType: normalizeServiceType(deal.source || deal.title),
      summary: find('project_summary', 'projectBrief', 'summary', 'business_description'),
      businessGoal: find('business_goal', 'goals', 'objective'),
      targetAudience: find('target_audience', 'audience'),
      expectedLaunchDate: find('expected_launch_date', 'launch_date', 'target_date'),
    },
    brand: {
      logoAvailability: find('logo', 'logo_availability'),
      brandColors: find('brand_colors', 'colors'),
      brandGuidelines: find('brand_guidelines'),
      contentAvailability: find('content', 'content_availability'),
    },
    technical: {
      existingDomain: find('domain', 'existing_domain'),
      hosting: find('hosting'),
      integrations: find('integrations'),
      cms: find('cms'),
      paymentGateway: find('payment_gateway'),
      apis: find('apis', 'api'),
      authentication: find('authentication', 'auth'),
      analytics: find('analytics'),
      seo: find('seo'),
      whatsapp: find('whatsapp'),
      thirdPartySystems: find('third_party_systems', 'third_party'),
    },
    additional: {
      references: find('references', 'reference_sites'),
      competitors: find('competitors'),
      additionalRequirements: find('additional_requirements', 'notes'),
    },
    sourceSubmissionId: submission.id,
  };

  const brief = [
    `Client: ${data.client.name}`,
    data.client.company ? `Company: ${data.client.company}` : '',
    `Project: ${deal.title}`,
    `Service Type: ${data.project.serviceType}`,
    data.project.summary ? `Summary: ${data.project.summary}` : '',
    data.project.businessGoal ? `Business Goal: ${data.project.businessGoal}` : '',
    data.project.targetAudience ? `Target Audience: ${data.project.targetAudience}` : '',
    data.project.expectedLaunchDate ? `Expected Launch: ${data.project.expectedLaunchDate}` : '',
    data.brand.logoAvailability ? `Logo: ${data.brand.logoAvailability}` : '',
    data.brand.brandColors ? `Brand Colors: ${data.brand.brandColors}` : '',
    data.technical.existingDomain ? `Domain: ${data.technical.existingDomain}` : '',
    data.technical.hosting ? `Hosting: ${data.technical.hosting}` : '',
    data.additional.additionalRequirements ? `Additional Requirements: ${data.additional.additionalRequirements}` : '',
  ].filter(Boolean).join('\n');

  return { brief, data };
}

function milestoneTemplate(serviceType: string) {
  const templates: Record<string, string[]> = {
    WEBSITE: ['Kickoff', 'Requirements Confirmed', 'Design', 'Development', 'Testing', 'Client Review', 'Launch', 'Handover'],
    WEB_APPLICATION: ['Kickoff', 'Requirements', 'UX / Architecture', 'Development', 'Integration', 'QA', 'Client Acceptance', 'Production Release'],
    MAINTENANCE: ['Assessment', 'Access Setup', 'Issue Resolution', 'Client Verification', 'Ongoing Support'],
    GENERAL: ['Kickoff', 'Requirements', 'Execution', 'Client Review', 'Handover'],
  };
  return templates[serviceType] || templates.GENERAL;
}

function deliverableTemplate(serviceType: string) {
  if (serviceType === 'WEB_APPLICATION') {
    return ['Requirement Confirmation', 'UX / Architecture', 'Core Development', 'Integrations', 'QA', 'UAT', 'Production Release', 'Handover'];
  }
  if (serviceType === 'MAINTENANCE') {
    return ['System Audit', 'Access Setup', 'Issue Resolution', 'Regression Testing', 'Client Verification', 'Support Handover'];
  }
  return [
    'Requirement Confirmation',
    'Sitemap / Structure',
    'UI Design',
    'Website Development',
    'Responsive Testing',
    'SEO Setup',
    'Analytics Setup',
    'Client Review',
    'Production Launch',
    'Handover',
  ];
}

function taskTemplate(serviceType: string) {
  if (serviceType === 'WEB_APPLICATION') {
    return [
      'Confirm requirements',
      'Define user roles',
      'Confirm feature scope',
      'Confirm integrations',
      'Prepare architecture',
      'Database design',
      'Authentication setup',
      'Core module development',
      'Admin module',
      'Integrations',
      'QA',
      'UAT',
      'Production deployment',
      'Handover',
    ];
  }
  if (serviceType === 'MAINTENANCE') {
    return [
      'Audit existing system',
      'Confirm access',
      'Reproduce reported issues',
      'Prioritize issues',
      'Apply fixes',
      'Regression testing',
      'Client verification',
      'Close maintenance cycle',
    ];
  }
  return [
    'Confirm project scope',
    'Verify onboarding responses',
    'Collect logo and brand assets',
    'Confirm content availability',
    'Confirm domain details',
    'Confirm hosting details',
    'Prepare sitemap',
    'Prepare wireframe',
    'Design homepage',
    'Client design approval',
    'Develop pages',
    'Responsive QA',
    'Browser testing',
    'Basic SEO configuration',
    'Analytics setup',
    'Final client review',
    'Production deployment',
    'Handover',
  ];
}

const requirementTemplate = [
  ['ASSET', 'Logo'],
  ['ASSET', 'Brand Guidelines'],
  ['CONTENT', 'Website Content'],
  ['CONTENT', 'Product Images'],
  ['ACCESS', 'Domain Access'],
  ['ACCESS', 'Hosting Access'],
  ['TECHNICAL', 'Google Analytics Access'],
  ['TECHNICAL', 'Search Console Access'],
  ['TECHNICAL', 'Meta Business Access'],
] as const;

const sensitiveAccessWarning =
  'Do not store passwords, OTPs, banking credentials, or secret API keys in LeadFlow. Use approved secure access-sharing methods.';

export async function createProjectFromDeal(auth: AuthPayload, dealId: string, payload: z.infer<typeof createProjectSchema>) {
  if (!canManageProjects(auth)) {
    throw new ProjectKickoffError('Project creation requires manager access.', 403, 'PROJECT_FORBIDDEN');
  }

  const existing = await prisma.project.findFirst({
    where: { companyId: auth.companyId, dealId },
    include: projectInclude,
  });
  if (existing) return { project: existing, created: false };

  const readiness = await getKickoffReadiness(auth, dealId);
  if (!readiness.ready) {
    if (!payload.overrideReason) {
      throw new ProjectKickoffError(readiness.blockers.join(' ') || 'Project is not ready for kickoff.', 409, 'PROJECT_NOT_READY');
    }
    if (!canOverrideReadiness(auth)) {
      throw new ProjectKickoffError('Only admins can override kickoff readiness.', 403, 'PROJECT_OVERRIDE_FORBIDDEN');
    }
  }

  const deal = await getDealForProject(auth, dealId);
  const submission = await getLatestSubmission(auth.companyId, dealId);
  if (!deal || !submission) {
    throw new ProjectKickoffError('Deal or onboarding submission was not found.', 404, 'PROJECT_SOURCE_NOT_FOUND');
  }

  const { brief, data } = buildBrief(deal, submission);
  const serviceType = data.project.serviceType;
  const dueBase = new Date();

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        companyId: auth.companyId,
        dealId: deal.id,
        contactId: deal.contactId,
        name: deal.title,
        serviceType,
        status: readiness.ready ? 'READY_FOR_KICKOFF' : 'DRAFT',
        ownerId: auth.userId,
        brief,
        briefData: data as Prisma.InputJsonValue,
        milestones: {
          create: milestoneTemplate(serviceType).map((title, index) => ({
            title,
            sortOrder: index + 1,
            status: index === 0 ? 'ACTIVE' : 'PENDING',
          })),
        },
        deliverables: {
          create: deliverableTemplate(serviceType).map((title, index) => ({
            title,
            sortOrder: index + 1,
          })),
        },
        requirements: {
          create: requirementTemplate.map(([type, label]) => ({
            type,
            label,
            notes: type === 'ACCESS' ? sensitiveAccessWarning : undefined,
          })),
        },
        tasks: {
          create: taskTemplate(serviceType).map((title, index) => ({
            title,
            description: 'Generated during project kickoff preparation.',
            companyId: auth.companyId,
            contactId: deal.contactId,
            dealId: deal.id,
            assignedToId: auth.userId,
            dueDate: new Date(dueBase.getTime() + (index + 1) * 24 * 60 * 60 * 1000),
          })),
        },
      },
    });

    await createActivityLog(
      {
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.PROJECT_CREATED,
        contactId: deal.contactId,
        dealId: deal.id,
        projectId: created.id,
        userId: auth.userId,
        metadata: { projectId: created.id, name: created.name, serviceType },
      },
      tx,
    );

    if (payload.overrideReason) {
      await createActivityLog(
        {
          companyId: auth.companyId,
          eventType: ACTIVITY_TYPES.PROJECT_KICKOFF_READINESS_OVERRIDE,
          contactId: deal.contactId,
          dealId: deal.id,
          projectId: created.id,
          userId: auth.userId,
          metadata: { reason: payload.overrideReason, blockers: readiness.blockers },
        },
        tx,
      );
    }

    return created;
  });

  return {
    project: await getProject(auth, project.id),
    created: true,
  };
}

function projectAccessWhere(auth: AuthPayload): Prisma.ProjectWhereInput {
  return {
    companyId: auth.companyId,
    ...(auth.role === 'AGENT'
      ? {
          OR: [
            { ownerId: auth.userId },
            { projectManagerId: auth.userId },
            { members: { some: { userId: auth.userId } } },
            { deal: { assignedToId: auth.userId } },
          ],
        }
      : {}),
  };
}

export async function listProjects(auth: AuthPayload, query: z.infer<typeof projectQuerySchema>) {
  const where: Prisma.ProjectWhereInput = {
    ...projectAccessWhere(auth),
    ...(query.status ? { status: query.status as ProjectStatus } : {}),
    ...(query.serviceType ? { serviceType: query.serviceType } : {}),
    ...(query.projectManagerId ? { projectManagerId: query.projectManagerId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { contact: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { contact: { companyName: { contains: query.search, mode: 'insensitive' } } },
            { deal: { title: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  return prisma.project.findMany({
    where,
    include: {
      contact: true,
      deal: { select: { id: true, title: true, stage: true } },
      projectManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { tasks: true, milestones: true, deliverables: true, requirements: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getProject(auth: AuthPayload, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, ...projectAccessWhere(auth) },
    include: projectInclude,
  });
}

async function ensureCompanyUser(companyId: string, userId?: string | null) {
  if (!userId) return null;
  const user = await prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null, status: 'ACTIVE' } });
  if (!user) throw new ProjectKickoffError('Assigned user must belong to this company.', 400, 'PROJECT_USER_INVALID');
  return user;
}

export async function updateProjectAssignment(auth: AuthPayload, projectId: string, payload: z.infer<typeof assignProjectSchema>) {
  if (!canManageProjects(auth)) throw new ProjectKickoffError('Project assignment requires manager access.', 403, 'PROJECT_FORBIDDEN');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: auth.companyId } });
  if (!project) throw new ProjectKickoffError('Project not found.', 404, 'PROJECT_NOT_FOUND');

  await ensureCompanyUser(auth.companyId, payload.ownerId);
  const manager = await ensureCompanyUser(auth.companyId, payload.projectManagerId);

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ownerId: payload.ownerId ?? undefined,
      projectManagerId: payload.projectManagerId ?? undefined,
    },
  });

  if (payload.projectManagerId) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: payload.projectManagerId } },
      create: { projectId: project.id, userId: payload.projectManagerId, role: 'PROJECT_MANAGER' },
      update: { role: 'PROJECT_MANAGER' },
    });

    await createActivityLog({
      companyId: auth.companyId,
      eventType: ACTIVITY_TYPES.PROJECT_MANAGER_ASSIGNED,
      contactId: project.contactId,
      dealId: project.dealId,
      projectId: project.id,
      userId: auth.userId,
      metadata: { assigneeId: payload.projectManagerId, assigneeName: manager ? `${manager.firstName} ${manager.lastName}` : undefined },
    });
  }

  return getProject(auth, updated.id);
}

export async function upsertProjectMember(auth: AuthPayload, projectId: string, payload: z.infer<typeof memberSchema>) {
  if (!canManageProjects(auth)) throw new ProjectKickoffError('Project team changes require manager access.', 403, 'PROJECT_FORBIDDEN');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: auth.companyId } });
  if (!project) throw new ProjectKickoffError('Project not found.', 404, 'PROJECT_NOT_FOUND');
  const user = await ensureCompanyUser(auth.companyId, payload.userId);

  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: payload.userId } },
    create: { projectId, userId: payload.userId, role: payload.role },
    update: { role: payload.role },
  });

  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.PROJECT_TEAM_MEMBER_ADDED,
    contactId: project.contactId,
    dealId: project.dealId,
    projectId: project.id,
    userId: auth.userId,
    metadata: { memberId: member.id, assigneeId: payload.userId, assigneeName: user ? `${user.firstName} ${user.lastName}` : undefined, role: payload.role },
  });

  return getProject(auth, projectId);
}

export async function removeProjectMember(auth: AuthPayload, projectId: string, memberId: string) {
  if (!canManageProjects(auth)) throw new ProjectKickoffError('Project team changes require manager access.', 403, 'PROJECT_FORBIDDEN');
  const member = await prisma.projectMember.findFirst({ where: { id: memberId, project: { id: projectId, companyId: auth.companyId } }, include: { project: true } });
  if (!member) throw new ProjectKickoffError('Project member not found.', 404, 'PROJECT_MEMBER_NOT_FOUND');
  await prisma.projectMember.delete({ where: { id: member.id } });
  await createActivityLog({
    companyId: auth.companyId,
    eventType: ACTIVITY_TYPES.PROJECT_TEAM_MEMBER_REMOVED,
    contactId: member.project.contactId,
    dealId: member.project.dealId,
    projectId: member.projectId,
    userId: auth.userId,
    metadata: { memberId, userId: member.userId },
  });
  return getProject(auth, projectId);
}

export async function updateProject(auth: AuthPayload, projectId: string, payload: z.infer<typeof projectUpdateSchema>) {
  if (!canManageProjects(auth)) throw new ProjectKickoffError('Project updates require manager access.', 403, 'PROJECT_FORBIDDEN');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: auth.companyId } });
  if (!project) throw new ProjectKickoffError('Project not found.', 404, 'PROJECT_NOT_FOUND');

  await prisma.project.update({
    where: { id: project.id },
    data: {
      startDate: payload.startDate ? new Date(payload.startDate) : payload.startDate === null ? null : undefined,
      targetDate: payload.targetDate ? new Date(payload.targetDate) : payload.targetDate === null ? null : undefined,
      internalNotes: payload.internalNotes ?? undefined,
    },
  });

  return getProject(auth, project.id);
}

const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ['READY_FOR_KICKOFF', 'CANCELLED'],
  READY_FOR_KICKOFF: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'CLIENT_REVIEW', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'CANCELLED'],
  CLIENT_REVIEW: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

async function sendKickoffEmail(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { contact: true, projectManager: true, company: true },
  });
  if (!project?.contact.email) return { sent: false, reason: 'CLIENT_EMAIL_MISSING' };

  const managerName = project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : 'Code2Crest project team';
  return sendEmail({
    to: project.contact.email,
    subject: 'Your Project Has Started - Code2Crest Technologies',
    html: `
      <p>Hello ${project.contact.firstName},</p>
      <p>Your project <strong>${project.name}</strong> has started.</p>
      <p><strong>Project Manager:</strong> ${managerName}</p>
      <p><strong>Service:</strong> ${project.serviceType || 'Project delivery'}</p>
      ${project.startDate ? `<p><strong>Kickoff Date:</strong> ${project.startDate.toDateString()}</p>` : ''}
      ${project.targetDate ? `<p><strong>Target Date:</strong> ${project.targetDate.toDateString()}</p>` : ''}
      <p>Next, our team will confirm scope, assets, access, and the delivery plan.</p>
      <p>Regards,<br/>Code2Crest Technologies</p>
    `,
    text: `Your project ${project.name} has started. Project Manager: ${managerName}.`,
  });
}

export async function transitionProjectStatus(auth: AuthPayload, projectId: string, payload: z.infer<typeof statusTransitionSchema>) {
  if (!canManageProjects(auth)) throw new ProjectKickoffError('Project status changes require manager access.', 403, 'PROJECT_FORBIDDEN');
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId: auth.companyId } });
  if (!project) throw new ProjectKickoffError('Project not found.', 404, 'PROJECT_NOT_FOUND');

  const nextStatus = payload.status as ProjectStatus;
  if (!allowedTransitions[project.status].includes(nextStatus)) {
    throw new ProjectKickoffError(`Cannot move project from ${project.status} to ${nextStatus}.`, 409, 'PROJECT_INVALID_TRANSITION');
  }

  if (nextStatus === 'ACTIVE') {
    if (!project.projectManagerId) throw new ProjectKickoffError('Assign a project manager before starting the project.', 409, 'PROJECT_MANAGER_REQUIRED');
    if (!project.startDate) throw new ProjectKickoffError('Set a start date before starting the project.', 409, 'PROJECT_START_DATE_REQUIRED');
    const readiness = await getKickoffReadiness(auth, project.dealId);
    if (!readiness.ready) throw new ProjectKickoffError('Kickoff readiness blockers must be resolved before starting.', 409, 'PROJECT_NOT_READY');
  }

  if (nextStatus === 'CANCELLED' && (!payload.reason || !canOverrideReadiness(auth))) {
    throw new ProjectKickoffError('Project cancellation requires an admin reason.', 403, 'PROJECT_CANCEL_REASON_REQUIRED');
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === 'COMPLETED' ? new Date() : project.completedAt,
    },
  });

  const eventType =
    nextStatus === 'ACTIVE'
      ? project.status === 'ON_HOLD'
        ? ACTIVITY_TYPES.PROJECT_RESUMED
        : ACTIVITY_TYPES.PROJECT_STARTED
      : nextStatus === 'ON_HOLD'
        ? ACTIVITY_TYPES.PROJECT_PUT_ON_HOLD
        : nextStatus === 'CLIENT_REVIEW'
          ? ACTIVITY_TYPES.PROJECT_CLIENT_REVIEW_STARTED
          : nextStatus === 'COMPLETED'
            ? ACTIVITY_TYPES.PROJECT_COMPLETED
            : nextStatus === 'CANCELLED'
              ? ACTIVITY_TYPES.PROJECT_CANCELLED
              : ACTIVITY_TYPES.PROJECT_CREATED;

  await createActivityLog({
    companyId: auth.companyId,
    eventType,
    contactId: project.contactId,
    dealId: project.dealId,
    projectId: project.id,
    userId: auth.userId,
    metadata: { from: project.status, to: nextStatus, reason: payload.reason },
  });

  if (nextStatus === 'ACTIVE') {
    try {
      const email = await sendKickoffEmail(project.id);
      await createActivityLog({
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.PROJECT_KICKOFF_EMAIL_SENT,
        contactId: project.contactId,
        dealId: project.dealId,
        projectId: project.id,
        userId: auth.userId,
        metadata: email as Prisma.InputJsonValue,
      });
    } catch (error) {
      await createActivityLog({
        companyId: auth.companyId,
        eventType: ACTIVITY_TYPES.PROJECT_KICKOFF_EMAIL_SENT,
        contactId: project.contactId,
        dealId: project.dealId,
        projectId: project.id,
        userId: auth.userId,
        metadata: { sent: false, error: 'EMAIL_FAILED' },
      });
    }
  }

  return getProject(auth, updated.id);
}

export async function createProjectHandoffPayload(auth: AuthPayload, projectId: string) {
  const project = await getProject(auth, projectId);
  if (!project) throw new ProjectKickoffError('Project not found.', 404, 'PROJECT_NOT_FOUND');

  return {
    company: { id: project.companyId },
    client: project.contact,
    project: {
      id: project.id,
      name: project.name,
      serviceType: project.serviceType,
      status: project.status,
      brief: project.brief,
      briefData: project.briefData,
    },
    deal: project.deal,
    team: project.members,
    milestones: project.milestones,
    tasks: project.tasks,
    requirements: project.requirements,
    deliverables: project.deliverables,
  };
}
