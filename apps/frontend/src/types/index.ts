// src/types/index.ts

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: string;
  status?: string;
  authProvider?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  company?: {
    id: string;
    name: string;
  };
  companyName?: string | null;
}

export interface Contact {
  id: string;
  phoneNumber: string;
  phoneCountryCode?: string | null;
  email?: string;
  firstName: string;
  lastName?: string;
  contactType?: 'PERSON' | 'COMPANY';
  companyName?: string | null;
  contactPersonName?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  groupId?: string | null;
  group?: ContactGroup | null;
  pincode?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  taxId?: string | null;
  avatar?: string;
  segment: string;
  status: string;
  source?: string;
  metaLeadId?: string;
  lastContactedAt?: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    contacts: number;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  content: string;
  channel?: string;
  messageType: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface Conversation {
  id: string;
  contact: Contact;
  contactId: string;
  assignedToId?: string | null;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'> | null;
  channel?: string;
  status: string;
  messageCount: number;
  lastMessageAt?: string;
  messages?: Message[];
}

export interface Deal {
  id: string;
  contactId: string;
  title: string;
  description?: string;
  value: number;
  currency?: string;
  stage: string;
  probability: number;
  source?: string;
  createdAt: string;
  updatedAt?: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  contactId?: string;
  dealId?: string;
  dueDate: string;
  status: string;
  assignedTo?: string;
  createdAt: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'>;
  deal?: Pick<Deal, 'title' | 'stage'>;
}

export interface QuotationItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  contactId: string;
  dealId?: string;
  status: string;
  gstPercent: number;
  paymentTerms?: string | null;
  terms?: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  createdAt: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber' | 'phoneCountryCode' | 'email' | 'contactType' | 'companyName' | 'contactPersonName' | 'country' | 'addressLine1' | 'city' | 'state' | 'pincode' | 'postalCode' | 'gstin' | 'taxId'>;
  deal?: Pick<Deal, 'title' | 'stage'>;
  items: QuotationItem[];
}

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quotationId?: string | null;
  contactId: string;
  dealId?: string | null;
  companyId: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal: number;
  taxPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxVatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  updatedAt?: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber' | 'phoneCountryCode' | 'email' | 'contactType' | 'companyName' | 'contactPersonName' | 'country' | 'addressLine1' | 'city' | 'state' | 'pincode' | 'postalCode' | 'gstin' | 'taxId'>;
  deal?: Pick<Deal, 'title' | 'stage'> | null;
  quotation?: Pick<Quotation, 'id' | 'quoteNumber' | 'status'> | null;
  items: InvoiceItem[];
}

export interface CompanySettings {
  id: string;
  name: string;
  gstin?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  postalCode?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  signature?: string | null;
  quotationTerms?: string | null;
  bankDetails?: string | null;
}

export interface Note {
  id: string;
  content: string;
  contactId?: string | null;
  conversationId?: string | null;
  dealId?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface ActivityLog {
  id: string;
  eventType: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: Pick<User, 'firstName' | 'lastName'> | null;
}

export interface DealWorkspace {
  deal: Deal;
  contact: Contact;
  tasks: Task[];
  quotations: Quotation[];
  activities: ActivityLog[];
  notes: Note[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  status: string;
  variables?: string[];
}
