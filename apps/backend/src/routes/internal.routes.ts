import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import {
  intakeCode2CrestLead,
  InternalLeadIntakeError,
} from '../services/internalLeadIntake.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

function readBearerToken(authorizationHeader?: string) {
  const [scheme, token] = authorizationHeader?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

function isAuthorized(authorizationHeader?: string) {
  const expectedSecret = process.env.CODE2CREST_LEADFLOW_INTEGRATION_SECRET;
  const receivedSecret = readBearerToken(authorizationHeader);

  if (!expectedSecret) {
    logger.error('CODE2CREST_LEADFLOW_INTEGRATION_SECRET is not configured');
    return 'SERVER_MISCONFIGURED' as const;
  }

  if (!receivedSecret) return false;

  const expected = Buffer.from(expectedSecret);
  const received = Buffer.from(receivedSecret);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

router.post('/leads/intake', async (req, res) => {
  const authorized = isAuthorized(req.get('authorization'));

  if (authorized === 'SERVER_MISCONFIGURED') {
    return res.status(503).json({ success: false, code: 'INTERNAL_LEAD_INTAKE_UNAVAILABLE' });
  }

  if (!authorized) {
    return res.status(401).json({ success: false, code: 'INTERNAL_LEAD_INTAKE_UNAUTHORIZED' });
  }

  try {
    const result = await intakeCode2CrestLead(req.body);
    logger.info({
      event: 'LEADFLOW_INTAKE_SUCCESS',
      source: 'CODE2CREST_GET_QUOTE',
      duplicateReused: result.duplicateReused,
      contactId: result.contactId,
      dealId: result.dealId,
    });

    return res.status(result.duplicateReused ? 200 : 201).json({
      success: true,
      contactId: result.contactId,
      dealId: result.dealId,
      duplicateReused: result.duplicateReused,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        code: 'INTERNAL_LEAD_INTAKE_VALIDATION_FAILED',
        details: error.errors,
      });
    }

    if (error instanceof InternalLeadIntakeError) {
      logger.error({ event: 'LEADFLOW_INTAKE_FAILED', code: error.code }, error.message);
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
      });
    }

    logger.error(
      { event: 'LEADFLOW_INTAKE_FAILED' },
      error instanceof Error ? error.message : 'Unknown internal intake error',
    );
    return res.status(500).json({ success: false, code: 'INTERNAL_LEAD_INTAKE_FAILED' });
  }
});

export default router;
