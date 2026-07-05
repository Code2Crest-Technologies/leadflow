import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

const contactSchema = z.object({
  phoneNumber: z.string().trim().optional().default(''),
  phoneCountryCode: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactType: z.enum(['PERSON', 'COMPANY']).default('PERSON'),
  companyName: z.string().optional(),
  contactPersonName: z.string().optional(),
  country: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  postalCode: z.string().optional(),
  gstin: z.string().optional(),
  taxId: z.string().optional(),
  groupId: z.string().optional().or(z.literal('')),
  segment: z.enum(['PROSPECT', 'LEAD', 'CUSTOMER', 'VIP', 'CHURNED']).default('LEAD'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'LOST']).default('ACTIVE'),
});

const importSchema = z.object({
  csvText: z.string().min(1),
});

router.use(requireAuth);

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeContactPayload(payload: z.infer<typeof contactSchema>) {
  const contactType = payload.contactType || 'PERSON';
  const firstName =
    emptyToNull(payload.firstName) ||
    emptyToNull(payload.contactPersonName) ||
    emptyToNull(payload.companyName);

  if (!firstName) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: contactType === 'COMPANY' ? 'Company name or contact person is required' : 'First name is required',
        path: [contactType === 'COMPANY' ? 'companyName' : 'firstName'],
      },
    ]);
  }

  const phoneNumber = payload.phoneNumber.trim();
  const email = emptyToNull(payload.email);

  if (!phoneNumber && !email) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: 'Phone number or email is required',
        path: ['phoneNumber'],
      },
    ]);
  }

  return {
    phoneNumber,
    phoneCountryCode: emptyToNull(payload.phoneCountryCode) || '+91',
    email,
    firstName,
    lastName: emptyToNull(payload.lastName),
    contactType,
    companyName: emptyToNull(payload.companyName),
    contactPersonName: emptyToNull(payload.contactPersonName),
    country: emptyToNull(payload.country) || 'India',
    addressLine1: emptyToNull(payload.addressLine1),
    addressLine2: emptyToNull(payload.addressLine2),
    city: emptyToNull(payload.city),
    state: emptyToNull(payload.state),
    pincode: emptyToNull(payload.pincode),
    postalCode: emptyToNull(payload.postalCode) || emptyToNull(payload.pincode),
    gstin: emptyToNull(payload.gstin),
    taxId: emptyToNull(payload.taxId),
    groupId: emptyToNull(payload.groupId),
    segment: payload.segment,
    status: payload.status,
  };
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { headers: [], rows: [] as Record<string, string>[] };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] || '';
      return record;
    }, {});
  });

  return { headers, rows };
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined;
    const data = await prisma.contact.findMany({
      where: {
        companyId: req.auth!.companyId,
        ...(groupId ? { groupId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { conversations: true, deals: true } },
      },
    });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = contactSchema.parse(req.body);
    const contactData = normalizeContactPayload(payload);
    if (contactData.groupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: contactData.groupId, companyId: req.auth!.companyId },
      });
      if (!group) {
        return res.status(404).json({ success: false, error: 'Contact group not found' });
      }
    }
    const data = await prisma.contact.create({
      data: {
        ...contactData,
        companyId: req.auth!.companyId,
      },
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(409).json({ success: false, error: 'A contact with this phone number already exists' });
  }
});

router.post('/import', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvText } = importSchema.parse(req.body);
    const { rows } = parseCsvText(csvText);
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, row] of rows.entries()) {
      try {
        const groupName = emptyToNull(row.groupName);
        let groupId: string | undefined;

        if (groupName) {
          const group = await prisma.contactGroup.upsert({
            where: {
              companyId_name: {
                companyId: req.auth!.companyId,
                name: groupName,
              },
            },
            create: {
              companyId: req.auth!.companyId,
              name: groupName,
            },
            update: {},
          });
          groupId = group.id;
        }

        const payload = contactSchema.parse({
          phoneNumber: row.phoneNumber || '',
          phoneCountryCode: row.phoneCountryCode || '+91',
          email: row.email || '',
          firstName: row.firstName,
          lastName: row.lastName,
          contactType: row.contactType === 'COMPANY' ? 'COMPANY' : 'PERSON',
          companyName: row.companyName,
          contactPersonName: row.contactPersonName,
          country: row.country || 'India',
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          city: row.city,
          state: row.state,
          pincode: row.pincode || row.postalCode,
          postalCode: row.postalCode || row.pincode,
          gstin: row.gstin,
          taxId: row.taxId,
          groupId,
          segment: ['PROSPECT', 'LEAD', 'CUSTOMER', 'VIP', 'CHURNED'].includes(row.segment)
            ? row.segment
            : 'LEAD',
        });

        const contactData = normalizeContactPayload(payload);

        await prisma.contact.create({
          data: {
            ...contactData,
            companyId: req.auth!.companyId,
          },
        });

        imported += 1;
      } catch (error) {
        skipped += 1;
        errors.push({
          row: index + 2,
          message:
            error instanceof z.ZodError
              ? error.errors[0]?.message || 'Validation error'
              : 'Could not import row',
        });
      }
    }

    res.status(201).json({ success: true, data: { imported, skipped, errors } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to import contacts' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const data = await prisma.contact.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
    include: { deals: true, conversations: true, group: true },
  });
  if (!data) return res.status(404).json({ success: false, error: 'Contact not found' });
  res.json({ success: true, data });
});

router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payload = contactSchema.parse(req.body);
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, companyId: req.auth!.companyId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Contact not found' });
    const contactData = normalizeContactPayload(payload);
    if (contactData.groupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: contactData.groupId, companyId: req.auth!.companyId },
      });
      if (!group) {
        return res.status(404).json({ success: false, error: 'Contact group not found' });
      }
    }
    const data = await prisma.contact.update({
      where: { id: existing.id },
      data: contactData,
    });
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update contact' });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const existing = await prisma.contact.findFirst({
    where: { id: req.params.id, companyId: req.auth!.companyId },
  });
  if (!existing) return res.status(404).json({ success: false, error: 'Contact not found' });
  await prisma.contact.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Contact deleted' });
});

export default router;
