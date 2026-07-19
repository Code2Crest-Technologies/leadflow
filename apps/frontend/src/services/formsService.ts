import { apiClient } from './apiClient';
import type {
  FormFieldType,
  FormPurpose,
  FormSubmissionStatus,
  LeadFlowForm,
  LeadFlowFormField,
  PublicFormLink,
  PublicFormPayload,
  FormSubmission,
} from '@/types';

export interface FormPayload {
  name: string;
  slug?: string;
  description?: string;
  purpose: FormPurpose;
}

export interface FieldPayload {
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  order: number;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
}

export interface PublicLinkPayload {
  expiresAt?: string;
  maxUses?: number | '';
  contactId?: string;
  dealId?: string;
}

export const FormsService = {
  async listForms() {
    const response = await apiClient.get('/api/forms');
    return response.data.data as LeadFlowForm[];
  },

  async createForm(payload: FormPayload) {
    const response = await apiClient.post('/api/forms', payload);
    return response.data.data as LeadFlowForm;
  },

  async getForm(id: string) {
    const response = await apiClient.get(`/api/forms/${id}`);
    return response.data.data as LeadFlowForm;
  },

  async updateForm(id: string, payload: Partial<FormPayload>) {
    const response = await apiClient.patch(`/api/forms/${id}`, payload);
    return response.data.data as LeadFlowForm;
  },

  async deleteForm(id: string) {
    const response = await apiClient.delete(`/api/forms/${id}`);
    return response.data.data as { id: string };
  },

  async publishForm(id: string) {
    const response = await apiClient.post(`/api/forms/${id}/publish`);
    return response.data.data as LeadFlowForm;
  },

  async archiveForm(id: string) {
    const response = await apiClient.post(`/api/forms/${id}/archive`);
    return response.data.data as LeadFlowForm;
  },

  async createField(formId: string, payload: FieldPayload) {
    const response = await apiClient.post(`/api/forms/${formId}/fields`, payload);
    return response.data.data as LeadFlowFormField;
  },

  async updateField(formId: string, fieldId: string, payload: FieldPayload) {
    const response = await apiClient.patch(`/api/forms/${formId}/fields/${fieldId}`, payload);
    return response.data.data as LeadFlowFormField;
  },

  async deleteField(formId: string, fieldId: string) {
    const response = await apiClient.delete(`/api/forms/${formId}/fields/${fieldId}`);
    return response.data.data as { id: string };
  },

  async reorderFields(formId: string, fieldIds: string[]) {
    const response = await apiClient.post(`/api/forms/${formId}/fields/reorder`, { fieldIds });
    return response.data.data as LeadFlowFormField[];
  },

  async listPublicLinks(formId: string) {
    const response = await apiClient.get(`/api/forms/${formId}/public-links`);
    return response.data.data as PublicFormLink[];
  },

  async createPublicLink(formId: string, payload: PublicLinkPayload) {
    const response = await apiClient.post(`/api/forms/${formId}/public-links`, payload);
    return response.data.data as PublicFormLink;
  },

  async deletePublicLink(formId: string, linkId: string) {
    const response = await apiClient.delete(`/api/forms/${formId}/public-links/${linkId}`);
    return response.data.data as { id: string };
  },

  async listSubmissions(formId: string) {
    const response = await apiClient.get(`/api/forms/${formId}/submissions`);
    return response.data.data as FormSubmission[];
  },

  async getSubmission(formId: string, submissionId: string) {
    const response = await apiClient.get(`/api/forms/${formId}/submissions/${submissionId}`);
    return response.data.data as FormSubmission;
  },

  async updateSubmissionStatus(formId: string, submissionId: string, status: FormSubmissionStatus) {
    const response = await apiClient.patch(`/api/forms/${formId}/submissions/${submissionId}/status`, { status });
    return response.data.data as FormSubmission;
  },

  async getPublicForm(token: string) {
    const response = await apiClient.get(`/api/public/forms/${token}`);
    return response.data.data as PublicFormPayload;
  },

  async submitPublicForm(token: string, values: Record<string, unknown>, website = '') {
    const response = await apiClient.post(`/api/public/forms/${token}/submit`, { values, website });
    return response.data.data as { submissionId: string };
  },
};
