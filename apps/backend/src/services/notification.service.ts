import { logger } from '../utils/logger.js';

interface FormSubmissionNotificationInput {
  companyId: string;
  formId: string;
  submissionId: string;
}

export async function notifyFormSubmission(input: FormSubmissionNotificationInput) {
  logger.info({
    event: 'FORM_SUBMISSION_NOTIFICATION_QUEUED',
    companyId: input.companyId,
    formId: input.formId,
    submissionId: input.submissionId,
  });
}
