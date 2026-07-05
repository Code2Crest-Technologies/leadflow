import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  createDeal,
  dealSchema,
  dealStageSchema,
  getDealTimeline,
  getDealWorkspace,
  listDeals,
  updateDeal,
  updateDealStage,
} from '../services/deal.service';

export async function listDealsController(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await listDeals(req.auth!);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch deals' });
  }
}

export async function createDealController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = dealSchema.parse(req.body);
    const data = await createDeal(req.auth!, payload);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create deal' });
  }
}

export async function getDealController(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDealWorkspace(req.auth!, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch deal' });
  }
}

export async function updateDealController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = dealSchema.parse(req.body);
    const data = await updateDeal(req.auth!, req.params.id, payload);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    if (data === 'CONTACT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
}

export async function updateDealStageController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = dealStageSchema.parse(req.body);
    const data = await updateDealStage(req.auth!, req.params.id, payload);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
}

export async function getDealTimelineController(req: AuthenticatedRequest, res: Response) {
  try {
    const data = await getDealTimeline(req.auth!, req.params.id);

    if (!data) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch deal timeline' });
  }
}
