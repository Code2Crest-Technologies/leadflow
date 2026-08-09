import { apiClient } from './apiClient';

export const LeadService = {
  async getDashboard() {
    return (await apiClient.get('/api/dashboard/summary')).data.data;
  },
  async getAnalytics() {
    return (await apiClient.get('/api/analytics')).data.data;
  },
  async getUsers() {
    return (await apiClient.get('/api/users')).data.data;
  },
  async createUser(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/users', payload)).data.data;
  },
  async updateUser(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/users/${id}`, payload)).data.data;
  },
  async resetUserPassword(id: string, password: string) {
    return (await apiClient.patch(`/api/users/${id}/password`, { password })).data;
  },
  async deleteUser(id: string) {
    return (await apiClient.delete(`/api/users/${id}`)).data;
  },
  async getContacts() {
    return (await apiClient.get('/api/contacts')).data.data;
  },
  async getContactGroups() {
    return (await apiClient.get('/api/contact-groups')).data.data;
  },
  async createContactGroup(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/contact-groups', payload)).data.data;
  },
  async updateContactGroup(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/contact-groups/${id}`, payload)).data.data;
  },
  async deleteContactGroup(id: string) {
    return (await apiClient.delete(`/api/contact-groups/${id}`)).data;
  },
  async createContact(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/contacts', payload)).data.data;
  },
  async updateContact(id: string, payload: Record<string, unknown>) {
    return (await apiClient.put(`/api/contacts/${id}`, payload)).data.data;
  },
  async importContacts(csvText: string) {
    return (await apiClient.post('/api/contacts/import', { csvText })).data.data;
  },
  async getCompany() {
    return (await apiClient.get('/api/company/me')).data.data;
  },
  async updateCompany(payload: Record<string, unknown>) {
    return (await apiClient.patch('/api/company/me', payload)).data.data;
  },
  async uploadCompanyAsset(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/company/assets', payload)).data.data;
  },
  async getDeals() {
    return (await apiClient.get('/api/deals')).data.data;
  },
  async getDeal(id: string) {
    return (await apiClient.get(`/api/deals/${id}`)).data.data;
  },
  async getDealTimeline(id: string) {
    return (await apiClient.get(`/api/deals/${id}/timeline`)).data.data;
  },
  async getDealKickoffReadiness(id: string) {
    return (await apiClient.get(`/api/deals/${id}/project-readiness`)).data.data;
  },
  async createProjectFromDeal(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/deals/${id}/project`, payload || {})).data.data;
  },
  async getProjects(params?: Record<string, unknown>) {
    return (await apiClient.get('/api/projects', { params })).data.data;
  },
  async getProject(id: string) {
    return (await apiClient.get(`/api/projects/${id}`)).data.data;
  },
  async updateProject(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/projects/${id}`, payload)).data.data;
  },
  async assignProject(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/projects/${id}/assignment`, payload)).data.data;
  },
  async upsertProjectMember(id: string, payload: Record<string, unknown>) {
    return (await apiClient.post(`/api/projects/${id}/members`, payload)).data.data;
  },
  async removeProjectMember(id: string, memberId: string) {
    return (await apiClient.delete(`/api/projects/${id}/members/${memberId}`)).data.data;
  },
  async transitionProjectStatus(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/projects/${id}/status`, payload)).data.data;
  },
  async getProjectHandoff(id: string) {
    return (await apiClient.get(`/api/projects/${id}/handoff`)).data.data;
  },
  async getDocumentTemplates() {
    return (await apiClient.get('/api/documents/templates')).data.data;
  },
  async createDocumentTemplate(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/documents/templates', payload)).data.data;
  },
  async cloneDocumentTemplate(id: string) {
    return (await apiClient.post(`/api/documents/templates/${id}/clone`)).data.data;
  },
  async getDocuments(params?: Record<string, unknown>) {
    return (await apiClient.get('/api/documents', { params })).data.data;
  },
  async getDocument(id: string) {
    return (await apiClient.get(`/api/documents/${id}`)).data.data;
  },
  async createDocument(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/documents', payload)).data.data;
  },
  async updateDocument(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/documents/${id}`, payload)).data.data;
  },
  async createDocumentRevision(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/documents/${id}/revisions`, payload || {})).data.data;
  },
  async markDocumentReady(id: string) {
    return (await apiClient.post(`/api/documents/${id}/ready`)).data.data;
  },
  async sendDocument(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/documents/${id}/send`, payload || {})).data.data;
  },
  async createDocumentPublicLink(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/documents/${id}/link`, payload || {})).data.data;
  },
  async cancelDocument(id: string) {
    return (await apiClient.post(`/api/documents/${id}/cancel`)).data.data;
  },
  async downloadDocumentPdf(id: string) {
    return (await apiClient.get(`/api/documents/${id}/pdf`, { responseType: 'blob' })).data;
  },
  async getPublicDocument(token: string) {
    return (await apiClient.get(`/api/public/documents/${token}`)).data.data;
  },
  async acceptPublicDocument(token: string, payload: Record<string, unknown>) {
    return (await apiClient.post(`/api/public/documents/${token}/accept`, payload)).data.data;
  },
  async rejectPublicDocument(token: string, payload: Record<string, unknown>) {
    return (await apiClient.post(`/api/public/documents/${token}/reject`, payload)).data.data;
  },
  async downloadPublicDocumentPdf(token: string) {
    return (await apiClient.get(`/api/public/documents/${token}/pdf`, { responseType: 'blob' })).data;
  },
  async createDeal(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/deals', payload)).data.data;
  },
  async updateDeal(id: string, payload: Record<string, unknown>) {
    return (await apiClient.put(`/api/deals/${id}`, payload)).data.data;
  },
  async updateDealStage(id: string, stage: string) {
    return (await apiClient.patch(`/api/deals/${id}/stage`, { stage })).data.data;
  },
  async startClientOnboarding(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/start`)).data.data;
  },
  async regenerateClientOnboarding(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/regenerate`)).data.data;
  },
  async createCopyableClientOnboardingLink(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/copy-link`)).data.data;
  },
  async sendClientOnboardingEmail(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/send-email`)).data.data;
  },
  async shareClientOnboardingWhatsApp(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/share-whatsapp`)).data.data;
  },
  async downloadClientOnboardingPdf(id: string) {
    return (await apiClient.get(`/api/deals/${id}/onboarding/pdf`, { responseType: 'blob' })).data;
  },
  async markClientOnboardingSent(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/mark-sent`)).data.data;
  },
  async markClientOnboardingUnderReview(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/under-review`)).data.data;
  },
  async markClientOnboardingCompleted(id: string) {
    return (await apiClient.post(`/api/deals/${id}/onboarding/complete`)).data.data;
  },
  async getTasks() {
    return (await apiClient.get('/api/tasks')).data.data;
  },
  async createTask(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/tasks', payload)).data.data;
  },
  async updateTask(id: string, payload: Record<string, unknown>) {
    return (await apiClient.put(`/api/tasks/${id}`, payload)).data.data;
  },
  async updateTaskStatus(id: string, status: string) {
    return (await apiClient.patch(`/api/tasks/${id}/status`, { status })).data.data;
  },
  async deleteTask(id: string) {
    return (await apiClient.delete(`/api/tasks/${id}`)).data;
  },
  async getQuotations() {
    return (await apiClient.get('/api/quotations')).data.data;
  },
  async createQuotation(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/quotations', payload)).data.data;
  },
  async updateQuotation(id: string, payload: Record<string, unknown>) {
    return (await apiClient.put(`/api/quotations/${id}`, payload)).data.data;
  },
  async updateQuotationStatus(id: string, status: string) {
    return (await apiClient.patch(`/api/quotations/${id}/status`, { status })).data.data;
  },
  async deleteQuotation(id: string) {
    return (await apiClient.delete(`/api/quotations/${id}`)).data;
  },
  async downloadQuotationPdf(id: string) {
    return (await apiClient.get(`/api/quotations/${id}/pdf`, { responseType: 'blob' })).data;
  },
  async getInvoices(params?: Record<string, unknown>) {
    return (await apiClient.get('/api/invoices', { params })).data.data;
  },
  async getInvoice(id: string) {
    return (await apiClient.get(`/api/invoices/${id}`)).data.data;
  },
  async createInvoice(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/invoices', payload)).data.data;
  },
  async updateInvoice(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/invoices/${id}`, payload)).data.data;
  },
  async updateInvoicePayment(id: string, payload: { amountReceived: number; paymentDate: string; notes?: string }) {
    return (await apiClient.patch(`/api/invoices/${id}/payment`, payload)).data.data;
  },
  async getBillingProfile() {
    return (await apiClient.get('/api/invoices/billing/profile')).data.data;
  },
  async updateBillingProfile(payload: Record<string, unknown>) {
    return (await apiClient.patch('/api/invoices/billing/profile', payload)).data.data;
  },
  async finalizeInvoice(id: string) {
    return (await apiClient.post(`/api/invoices/${id}/finalize`)).data.data;
  },
  async sendInvoice(id: string) {
    return (await apiClient.post(`/api/invoices/${id}/send`)).data.data;
  },
  async createInvoicePublicLink(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/invoices/${id}/link`, payload || {})).data.data;
  },
  async createRazorpayInvoiceOrder(id: string, payload?: Record<string, unknown>) {
    return (await apiClient.post(`/api/invoices/${id}/payment/razorpay`, payload || {})).data.data;
  },
  async verifyRazorpayInvoicePayment(id: string, payload: Record<string, unknown>) {
    return (await apiClient.post(`/api/invoices/${id}/payment/razorpay/verify`, payload)).data.data;
  },
  async downloadReceiptPdf(invoiceId: string, receiptId: string) {
    return (await apiClient.get(`/api/invoices/${invoiceId}/receipts/${receiptId}/pdf`, { responseType: 'blob' })).data;
  },
  async getPublicInvoice(token: string) {
    return (await apiClient.get(`/api/public/invoices/${token}`)).data.data;
  },
  async downloadPublicInvoicePdf(token: string) {
    return (await apiClient.get(`/api/public/invoices/${token}/pdf`, { responseType: 'blob' })).data;
  },
  async updateInvoiceStatus(id: string, status: string) {
    return (await apiClient.patch(`/api/invoices/${id}`, { status })).data.data;
  },
  async markInvoiceSent(id: string) {
    return (await apiClient.post(`/api/invoices/${id}/mark-sent`)).data.data;
  },
  async markInvoicePaid(id: string) {
    return (await apiClient.post(`/api/invoices/${id}/mark-paid`)).data.data;
  },
  async markInvoiceCancelled(id: string) {
    return (await apiClient.post(`/api/invoices/${id}/mark-cancelled`)).data.data;
  },
  async convertQuotationToInvoice(quotationId: string) {
    return (await apiClient.post(`/api/invoices/from-quotation/${quotationId}`)).data.data;
  },
  async downloadInvoicePdf(id: string) {
    return (await apiClient.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' })).data;
  },
  async downloadExport(
    entity:
      | 'contacts'
      | 'deals'
      | 'quotations'
      | 'invoices'
      | 'analytics-summary'
      | 'analytics-sources'
      | 'analytics-monthly-sales'
      | 'analytics-invoices',
    params?: Record<string, unknown>,
  ) {
    return (await apiClient.get(`/api/export/${entity}.csv`, { params, responseType: 'blob' })).data;
  },
  async getNotes(dealId: string) {
    return (await apiClient.get('/api/notes', { params: { dealId } })).data.data;
  },
  async createNote(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/notes', payload)).data.data;
  },
  async updateNote(id: string, payload: Record<string, unknown>) {
    return (await apiClient.patch(`/api/notes/${id}`, payload)).data.data;
  },
  async deleteNote(id: string) {
    return (await apiClient.delete(`/api/notes/${id}`)).data;
  },
};
