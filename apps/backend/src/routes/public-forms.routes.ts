import { Router } from 'express';
import { z } from 'zod';
import { createRateLimiter } from '../middleware/security.js';
import {
  FormSubmissionValidationError,
  FormsError,
  getPublicFormByToken,
  publicSubmissionSchema,
  submitPublicForm,
} from '../services/forms.service.js';

const router = Router();

function publicFormPayload(link: Awaited<ReturnType<typeof getPublicFormByToken>>) {
  const contactName = [link.contact?.firstName, link.contact?.lastName].filter(Boolean).join(' ').trim();
  const serviceOptions = new Set([
    'Website Development',
    'Web Application Development',
    'E-Commerce Solutions',
    'Mobile App Development',
    'Custom Software Development',
    'Maintenance & Support',
    'SaaS / Product Development',
    'Other',
  ]);
  const serviceType = link.deal?.source && serviceOptions.has(link.deal.source) ? link.deal.source : undefined;

  return {
    form: {
      name: link.form.name,
      description: link.form.description,
      purpose: link.form.purpose,
      fields: link.form.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder,
        helpText: field.helpText,
        required: field.required,
        order: field.order,
        options: field.options,
        validation: field.validation,
      })),
    },
    company: link.company,
    prefill: {
      primaryContactName: contactName || undefined,
      companyName: link.contact?.companyName || undefined,
      businessEmail: link.contact?.email || undefined,
      phone: link.contact?.phoneNumber || undefined,
      projectName: link.deal?.title || undefined,
      serviceType,
    },
  };
}

router.get('/:token', async (req, res) => {
  try {
    const link = await getPublicFormByToken(req.params.token);
    res.json({ success: true, data: publicFormPayload(link) });
  } catch (error) {
    if (error instanceof FormsError) {
      return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to load form' });
  }
});

router.post(
  '/:token/submit',
  createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 }),
  async (req, res) => {
    try {
      const payload = publicSubmissionSchema.parse(req.body);
      const result = await submitPublicForm(req.params.token, payload);
      if (result.honeypot) {
        return res.json({ success: true, message: 'Form submitted successfully.' });
      }
      return res.status(201).json({ success: true, data: { submissionId: result.submissionId } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
      }
      if (error instanceof FormSubmissionValidationError) {
        return res.status(400).json({ success: false, error: 'Validation error', fieldErrors: error.fieldErrors });
      }
      if (error instanceof FormsError) {
        return res.status(error.statusCode).json({ success: false, code: error.code, error: error.message });
      }
      return res.status(500).json({ success: false, error: 'Failed to submit form' });
    }
  },
);

export default router;
