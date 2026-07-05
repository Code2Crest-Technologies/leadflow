// src/services/messageService.ts

import { apiClient } from './apiClient';

export const MessageService = {
  async getConversations() {
    const { data } = await apiClient.get('/api/messages/conversations');
    return data.data;
  },

  async createConversation(contactId: string, channel = 'MANUAL') {
    const { data } = await apiClient.post('/api/messages/conversations', { contactId, channel });
    return data.data;
  },

  async getMessages(conversationId: string) {
    const { data } = await apiClient.get(`/api/messages/conversation/${conversationId}`);
    return data.data;
  },

  async sendMessage(payload: {
    conversationId: string;
    contactId: string;
    content: string;
    messageType: string;
  }) {
    const { data } = await apiClient.post('/api/messages/send', payload);
    return data.data;
  },

  async sendTemplateMessage(payload: {
    conversationId: string;
    contactId: string;
    templateId: string;
  }) {
    const { data } = await apiClient.post('/api/messages/send-template', payload);
    return data.data;
  },

  async assignConversation(conversationId: string, assignedToId: string | null) {
    const { data } = await apiClient.patch(`/api/conversations/${conversationId}/assign`, { assignedToId });
    return data.data;
  },

  async getAssignees() {
    const { data } = await apiClient.get('/api/conversations/assignees');
    return data.data;
  },

  async getConversationNotes(conversationId: string) {
    const { data } = await apiClient.get(`/api/conversations/${conversationId}/notes`);
    return data.data;
  },

  async createConversationNote(conversationId: string, content: string) {
    const { data } = await apiClient.post(`/api/conversations/${conversationId}/notes`, { content });
    return data.data;
  },

  async updateConversationNote(noteId: string, content: string) {
    const { data } = await apiClient.patch(`/api/conversations/notes/${noteId}`, { content });
    return data.data;
  },

  async deleteConversationNote(noteId: string) {
    const { data } = await apiClient.delete(`/api/conversations/notes/${noteId}`);
    return data;
  },
};
