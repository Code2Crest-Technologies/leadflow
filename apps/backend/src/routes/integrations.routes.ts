import { Router, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';

const router = Router();

const optionalString = z.string().optional().or(z.literal(''));

const integrationsSchema = z.object({
  whatsapp: z.object({
    whatsappBusinessAccountId: optionalString,
    phoneNumberId: optionalString,
    accessToken: optionalString,
    verifyToken: optionalString,
  }),
  meta: z.object({
    metaAppId: optionalString,
    metaAppSecret: optionalString,
    businessManagerId: optionalString,
    facebookPageId: optionalString,
    instagramBusinessAccountId: optionalString,
  }),
});

type IntegrationsPayload = z.infer<typeof integrationsSchema>;
type IntegrationConfig = Record<string, string | null>;

router.use(requireAuth);
router.use(requireRole('ADMIN'));

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isMaskedSecret(value?: string | null) {
  return !value || /^[*]+/.test(value);
}

function maskSecret(value?: string | null) {
  if (!value) return null;
  const suffix = value.slice(-4);
  return `****${suffix}`;
}

function toConfig(value: unknown): IntegrationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as IntegrationConfig;
}

function mergeConfig(
  existing: IntegrationConfig,
  incoming: Record<string, string | undefined>,
  secretKeys: string[] = [],
) {
  const next: IntegrationConfig = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (secretKeys.includes(key) && isMaskedSecret(value)) continue;
    next[key] = emptyToNull(value);
  }
  return next;
}

function buildWebhookUrl(req: AuthenticatedRequest) {
  const publicUrl = process.env.PUBLIC_API_URL || process.env.API_URL;
  if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/api/webhook`;
  return `${req.protocol}://${req.get('host')}/api/webhook`;
}

router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [company, integrations] = await Promise.all([
      prisma.company.findUnique({
        where: { id: req.auth!.companyId },
        select: {
          whatsappBusinessAccountId: true,
          whatsappPhoneNumber: true,
          whatsappAccessToken: true,
          metaAdsAccountId: true,
          metaAdsAccessToken: true,
        },
      }),
      prisma.integration.findMany({
        where: { companyId: req.auth!.companyId, type: { in: ['whatsapp_business', 'meta_business'] } },
      }),
    ]);

    const whatsapp = integrations.find((item) => item.type === 'whatsapp_business');
    const meta = integrations.find((item) => item.type === 'meta_business');
    const whatsappConfig = toConfig(whatsapp?.config);
    const metaConfig = toConfig(meta?.config);

    res.json({
      success: true,
      data: {
        whatsapp: {
          whatsappBusinessAccountId:
            company?.whatsappBusinessAccountId || whatsappConfig.whatsappBusinessAccountId || null,
          phoneNumberId: company?.whatsappPhoneNumber || whatsappConfig.phoneNumberId || null,
          accessToken: maskSecret(company?.whatsappAccessToken || whatsapp?.accessToken),
          verifyToken: maskSecret(whatsappConfig.verifyToken),
          webhookUrl: buildWebhookUrl(req),
          status: whatsapp?.status || (company?.whatsappAccessToken ? 'configured' : 'not_configured'),
        },
        meta: {
          metaAppId: metaConfig.metaAppId || null,
          metaAppSecret: maskSecret(metaConfig.metaAppSecret),
          businessManagerId: metaConfig.businessManagerId || company?.metaAdsAccountId || null,
          facebookPageId: metaConfig.facebookPageId || null,
          instagramBusinessAccountId: metaConfig.instagramBusinessAccountId || null,
          status: meta?.status || (company?.metaAdsAccessToken ? 'configured' : 'not_configured'),
        },
        webhook: {
          url: buildWebhookUrl(req),
          status: company?.whatsappAccessToken ? 'ready' : 'waiting_for_whatsapp_credentials',
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch integration settings' });
  }
});

router.patch('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = integrationsSchema.parse(req.body);

    const [existingWhatsapp, existingMeta] = await Promise.all([
      prisma.integration.findUnique({
        where: {
          companyId_type: {
            companyId: req.auth!.companyId,
            type: 'whatsapp_business',
          },
        },
      }),
      prisma.integration.findUnique({
        where: {
          companyId_type: {
            companyId: req.auth!.companyId,
            type: 'meta_business',
          },
        },
      }),
    ]);

    const whatsappConfig = mergeConfig(
      toConfig(existingWhatsapp?.config),
      {
        whatsappBusinessAccountId: payload.whatsapp.whatsappBusinessAccountId,
        phoneNumberId: payload.whatsapp.phoneNumberId,
        verifyToken: payload.whatsapp.verifyToken,
      },
      ['verifyToken'],
    );

    const metaConfig = mergeConfig(
      toConfig(existingMeta?.config),
      {
        metaAppId: payload.meta.metaAppId,
        metaAppSecret: payload.meta.metaAppSecret,
        businessManagerId: payload.meta.businessManagerId,
        facebookPageId: payload.meta.facebookPageId,
        instagramBusinessAccountId: payload.meta.instagramBusinessAccountId,
      },
      ['metaAppSecret'],
    );

    const accessToken = isMaskedSecret(payload.whatsapp.accessToken)
      ? existingWhatsapp?.accessToken || null
      : emptyToNull(payload.whatsapp.accessToken);

    await Promise.all([
      prisma.integration.upsert({
        where: {
          companyId_type: {
            companyId: req.auth!.companyId,
            type: 'whatsapp_business',
          },
        },
        create: {
          companyId: req.auth!.companyId,
          type: 'whatsapp_business',
          name: 'WhatsApp Business API',
          accessToken,
          config: whatsappConfig as Prisma.InputJsonValue,
          status: accessToken ? 'configured' : 'not_configured',
        },
        update: {
          accessToken,
          config: whatsappConfig as Prisma.InputJsonValue,
          status: accessToken ? 'configured' : 'not_configured',
        },
      }),
      prisma.integration.upsert({
        where: {
          companyId_type: {
            companyId: req.auth!.companyId,
            type: 'meta_business',
          },
        },
        create: {
          companyId: req.auth!.companyId,
          type: 'meta_business',
          name: 'Meta Business',
          config: metaConfig as Prisma.InputJsonValue,
          status: metaConfig.metaAppId || metaConfig.businessManagerId ? 'configured' : 'not_configured',
        },
        update: {
          config: metaConfig as Prisma.InputJsonValue,
          status: metaConfig.metaAppId || metaConfig.businessManagerId ? 'configured' : 'not_configured',
        },
      }),
      prisma.company.update({
        where: { id: req.auth!.companyId },
        data: {
          whatsappBusinessAccountId: emptyToNull(payload.whatsapp.whatsappBusinessAccountId),
          whatsappPhoneNumber: emptyToNull(payload.whatsapp.phoneNumberId),
          whatsappAccessToken: accessToken,
          metaAdsAccountId: emptyToNull(payload.meta.businessManagerId),
        },
      }),
    ]);

    res.json({ success: true, message: 'Integration settings updated' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update integration settings' });
  }
});

export default router;
