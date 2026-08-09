import { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  DocumentWorkflowError,
  acceptDocumentSchema,
  acceptPublicDocument,
  cancelDocument,
  cloneDocumentTemplate,
  createDocument,
  createDocumentPublicLink,
  createDocumentRevision,
  createDocumentSchema,
  createDocumentTemplate,
  createRevisionSchema,
  documentQuerySchema,
  generateDocumentPdf,
  generatePublicDocumentPdf,
  getDocument,
  getPublicDocument,
  listDocumentTemplates,
  listDocuments,
  markDocumentReady,
  rejectDocumentSchema,
  rejectPublicDocument,
  sendDocumentSchema,
  sendDocumentToClient,
  templateSchema,
  updateDocumentSchema,
  updateDocumentTemplate,
  updateDraftDocument,
} from '../services/documentWorkflow.service.js';

function handleDocumentError(error: unknown, res: Response) {
  if (error instanceof DocumentWorkflowError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
  }
  return res.status(500).json({ success: false, error: 'Document request failed' });
}

export async function listDocumentTemplatesController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await listDocumentTemplates(req.auth!) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function createDocumentTemplateController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await createDocumentTemplate(req.auth!, templateSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function updateDocumentTemplateController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await updateDocumentTemplate(req.auth!, req.params.id, templateSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function cloneDocumentTemplateController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await cloneDocumentTemplate(req.auth!, req.params.id) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function listDocumentsController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await listDocuments(req.auth!, documentQuerySchema.parse(req.query)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function getDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    const document = await getDocument(req.auth!, req.params.id);
    if (!document) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true, data: document });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function createDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await createDocument(req.auth!, createDocumentSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function updateDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await updateDraftDocument(req.auth!, req.params.id, updateDocumentSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function createDocumentRevisionController(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(201).json({ success: true, data: await createDocumentRevision(req.auth!, req.params.id, createRevisionSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function markDocumentReadyController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await markDocumentReady(req.auth!, req.params.id) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function sendDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await sendDocumentToClient(req.auth!, req.params.id, sendDocumentSchema.parse(req.body)) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function createDocumentPublicLinkController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = sendDocumentSchema.parse(req.body);
    res.status(201).json({ success: true, data: await createDocumentPublicLink(req.auth!, req.params.id, payload.expiresAt) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function cancelDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await cancelDocument(req.auth!, req.params.id) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function downloadDocumentPdfController(req: AuthenticatedRequest, res: Response) {
  try {
    const pdf = await generateDocumentPdf(req.auth!, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-${req.params.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function getPublicDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    res.json({ success: true, data: await getPublicDocument(req.params.token) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function acceptPublicDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = acceptDocumentSchema.parse(req.body);
    res.status(201).json({ success: true, data: await acceptPublicDocument(req.params.token, payload, req.headers['user-agent']) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function rejectPublicDocumentController(req: AuthenticatedRequest, res: Response) {
  try {
    const payload = rejectDocumentSchema.parse(req.body);
    res.json({ success: true, data: await rejectPublicDocument(req.params.token, payload) });
  } catch (error) {
    handleDocumentError(error, res);
  }
}

export async function downloadPublicDocumentPdfController(req: AuthenticatedRequest, res: Response) {
  try {
    const pdf = await generatePublicDocumentPdf(req.params.token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.send(pdf);
  } catch (error) {
    handleDocumentError(error, res);
  }
}
