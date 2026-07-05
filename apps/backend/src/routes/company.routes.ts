import { Router, Response } from 'express';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';

const router = Router();

const companySettingsSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  addressLine1: z.string().optional().or(z.literal('')),
  addressLine2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  postalCode: z.string().optional().or(z.literal('')),
  phoneCountryCode: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  signatureUrl: z.string().optional().or(z.literal('')),
  quotationTerms: z.string().optional().or(z.literal('')),
  bankDetails: z.string().optional().or(z.literal('')),
});

const uploadSchema = z.object({
  kind: z.enum(['logo', 'signature']),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1),
});

router.use(requireAuth);

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const companySelect = {
  id: true,
  name: true,
  gstin: true,
  country: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  pincode: true,
  postalCode: true,
  phoneCountryCode: true,
  phone: true,
  email: true,
  website: true,
  logoUrl: true,
  signatureUrl: true,
  signature: true,
  quotationTerms: true,
  bankDetails: true,
};

const uploadConfig = {
  logo: {
    allowed: ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'],
    maxBytes: 1024 * 1024,
  },
  signature: {
    allowed: ['image/png', 'image/jpeg', 'image/jpg'],
    maxBytes: 500 * 1024,
  },
};

router.get('/me', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await prisma.company.findUnique({
      where: { id: req.auth!.companyId },
      select: companySelect,
    });

    if (!data) return res.status(404).json({ success: false, error: 'Company not found' });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch company settings' });
  }
});

router.patch('/me', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = companySettingsSchema.parse(req.body);
    const data = await prisma.company.update({
      where: { id: req.auth!.companyId },
      data: {
        name: payload.name.trim(),
        gstin: emptyToNull(payload.gstin),
        country: emptyToNull(payload.country) || 'India',
        addressLine1: emptyToNull(payload.addressLine1),
        addressLine2: emptyToNull(payload.addressLine2),
        city: emptyToNull(payload.city),
        state: emptyToNull(payload.state),
        pincode: emptyToNull(payload.pincode),
        postalCode: emptyToNull(payload.postalCode) || emptyToNull(payload.pincode),
        phoneCountryCode: emptyToNull(payload.phoneCountryCode) || '+91',
        phone: emptyToNull(payload.phone),
        email: emptyToNull(payload.email),
        website: emptyToNull(payload.website),
        logoUrl: emptyToNull(payload.logoUrl),
        signatureUrl: emptyToNull(payload.signatureUrl),
        quotationTerms: emptyToNull(payload.quotationTerms),
        bankDetails: emptyToNull(payload.bankDetails),
      },
      select: companySelect,
    });

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update company settings' });
  }
});

router.post('/assets', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = uploadSchema.parse(req.body);
    const config = uploadConfig[payload.kind];

    if (!config.allowed.includes(payload.mimeType)) {
      return res.status(400).json({ success: false, error: 'Invalid file type' });
    }

    const buffer = Buffer.from(payload.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length > config.maxBytes) {
      return res.status(400).json({ success: false, error: 'File too large' });
    }

    const extension = payload.mimeType === 'image/svg+xml'
      ? 'svg'
      : payload.mimeType.includes('png')
        ? 'png'
        : 'jpg';
    const directory = path.join(process.cwd(), 'uploads', 'company-assets');
    await mkdir(directory, { recursive: true });
    const fileName = `${req.auth!.companyId}-${payload.kind}-${Date.now()}.${extension}`;
    const diskPath = path.join(directory, fileName);
    await writeFile(diskPath, buffer);

    const url = `/uploads/company-assets/${fileName}`;
    const data = await prisma.company.update({
      where: { id: req.auth!.companyId },
      data: payload.kind === 'logo' ? { logo: url, logoUrl: url } : { signature: url, signatureUrl: url },
      select: companySelect,
    });

    res.json({ success: true, data: { url, company: data } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to upload company asset' });
  }
});

export default router;
