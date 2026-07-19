import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import {
  archiveForm,
  createField,
  createForm,
  createFormSchema,
  createPublicLink,
  deleteField,
  deleteForm,
  deletePublicLink,
  fieldSchema,
  FormsError,
  getForm,
  getSubmission,
  listForms,
  listPublicLinks,
  listSubmissions,
  publishForm,
  publicLinkSchema,
  reorderFields,
  reorderSchema,
  submissionStatusSchema,
  updateField,
  updateForm,
  updateFormSchema,
  updateSubmissionStatus,
} from '../services/forms.service.js';

const router = Router();

function handleFormsError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
  }
  if (error instanceof FormsError) {
    return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
  }
  return res.status(500).json({ success: false, error: 'Forms request failed' });
}

router.use(requireAuth);

router.get('/', requirePermission('forms.read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await listForms(req.auth!) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/', requirePermission('forms.create'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = createFormSchema.parse(req.body);
    res.status(201).json({ success: true, data: await createForm(req.auth!, payload) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.get('/:id', requirePermission('forms.read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await getForm(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.patch('/:id', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = updateFormSchema.parse(req.body);
    res.json({ success: true, data: await updateForm(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.delete('/:id', requirePermission('forms.delete'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await deleteForm(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/:id/publish', requirePermission('forms.publish'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await publishForm(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/:id/archive', requirePermission('forms.publish'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await archiveForm(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/:id/fields', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = fieldSchema.parse(req.body);
    res.status(201).json({ success: true, data: await createField(req.auth!, req.params.id, payload) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.patch('/:id/fields/:fieldId', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = fieldSchema.parse(req.body);
    res.json({ success: true, data: await updateField(req.auth!, req.params.id, req.params.fieldId, payload) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.delete('/:id/fields/:fieldId', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await deleteField(req.auth!, req.params.id, req.params.fieldId) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/:id/fields/reorder', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = reorderSchema.parse(req.body);
    res.json({ success: true, data: await reorderFields(req.auth!, req.params.id, payload.fieldIds) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.post('/:id/public-links', requirePermission('forms.publish'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = publicLinkSchema.parse(req.body);
    const origin = req.get('origin') || undefined;
    res.status(201).json({ success: true, data: await createPublicLink(req.auth!, req.params.id, payload, origin) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.get('/:id/public-links', requirePermission('forms.read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await listPublicLinks(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.delete('/:id/public-links/:linkId', requirePermission('forms.publish'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await deletePublicLink(req.auth!, req.params.id, req.params.linkId) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.get('/:id/submissions', requirePermission('forms.submissions.read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await listSubmissions(req.auth!, req.params.id) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.get('/:id/submissions/:submissionId', requirePermission('forms.submissions.read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await getSubmission(req.auth!, req.params.id, req.params.submissionId) });
  } catch (error) {
    handleFormsError(error, res);
  }
});

router.patch('/:id/submissions/:submissionId/status', requirePermission('forms.update'), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = submissionStatusSchema.parse(req.body);
    res.json({
      success: true,
      data: await updateSubmissionStatus(req.auth!, req.params.id, req.params.submissionId, payload.status),
    });
  } catch (error) {
    handleFormsError(error, res);
  }
});

export default router;
