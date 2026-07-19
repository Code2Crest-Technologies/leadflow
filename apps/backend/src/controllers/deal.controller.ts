import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import {
  createDeal,
  dealSchema,
  dealStageSchema,
  getDealTimeline,
  getDealWorkspace,
  listDeals,
  updateDeal,
  updateDealStage,
} from '../services/deal.service.js';
import {
  ClientOnboardingError,
  markClientOnboardingSent,
  regenerateClientOnboardingLink,
  startClientOnboarding,
  updateOnboardingReviewStatus,
} from '../services/clientOnboarding.service.js';

function handleClientOnboardingError(error: unknown, res: Response) {
  if (error instanceof ClientOnboardingError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
  }
  return res.status(500).json({ success: false, error: 'Client onboarding request failed' });
}

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

export async function startClientOnboardingController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await startClientOnboarding(req.auth!, req.params.id) });
  } catch (error) {
    handleClientOnboardingError(error, res);
  }
}

export async function regenerateClientOnboardingController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await regenerateClientOnboardingLink(req.auth!, req.params.id) });
  } catch (error) {
    handleClientOnboardingError(error, res);
  }
}

export async function markClientOnboardingSentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await markClientOnboardingSent(req.auth!, req.params.id) });
  } catch (error) {
    handleClientOnboardingError(error, res);
  }
}

export async function markClientOnboardingUnderReviewController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await updateOnboardingReviewStatus(req.auth!, req.params.id, 'UNDER_REVIEW') });
  } catch (error) {
    handleClientOnboardingError(error, res);
  }
}

export async function markClientOnboardingCompletedController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await updateOnboardingReviewStatus(req.auth!, req.params.id, 'COMPLETED') });
  } catch (error) {
    handleClientOnboardingError(error, res);
  }
}
