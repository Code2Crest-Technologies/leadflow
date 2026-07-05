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
  async createDeal(payload: Record<string, unknown>) {
    return (await apiClient.post('/api/deals', payload)).data.data;
  },
  async updateDeal(id: string, payload: Record<string, unknown>) {
    return (await apiClient.put(`/api/deals/${id}`, payload)).data.data;
  },
  async updateDealStage(id: string, stage: string) {
    return (await apiClient.patch(`/api/deals/${id}/stage`, { stage })).data.data;
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
