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
  phoneNormalized?: string | null;
  whatsappOptInStatus?: string | null;
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
  providerStatus?: string | null;
  providerMessageId?: string | null;
  templateName?: string | null;
  sentAt?: string | null;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
}

export interface Conversation {
  id: string;
  contact: Contact;
  contactId: string;
  assignedToId?: string | null;
  assignedTo?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'> | null;
  dealId?: string | null;
  deal?: Pick<Deal, 'id' | 'title' | 'stage' | 'value' | 'assignedToId'> | null;
  channel?: string;
  status: string;
  messageCount: number;
  unreadCount?: number;
  lastMessageAt?: string;
  lastInboundAt?: string | null;
  serviceWindowEndsAt?: string | null;
  resolvedAt?: string | null;
  messages?: Message[];
}

export interface Deal {
  id: string;
  contactId: string;
  assignedToId?: string | null;
  title: string;
  description?: string;
  value: number;
  currency?: string;
  stage: string;
  probability: number;
  source?: string;
  onboardingStatus?: DealOnboardingStatus;
  createdAt: string;
  updatedAt?: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'>;
}

export type ProjectStatus =
  | 'DRAFT'
  | 'READY_FOR_KICKOFF'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'CLIENT_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export interface KickoffReadinessCheck {
  key: string;
  label: string;
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_CONFIGURED';
  required: boolean;
  message: string;
}

export interface KickoffReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  checks: KickoffReadinessCheck[];
  project?: Project | null;
}

export interface Project {
  id: string;
  companyId: string;
  dealId: string;
  contactId: string;
  name: string;
  serviceType?: string | null;
  status: ProjectStatus;
  ownerId?: string | null;
  projectManagerId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  completedAt?: string | null;
  brief?: string | null;
  briefData?: Record<string, unknown> | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
  deal?: Pick<Deal, 'id' | 'title' | 'stage'> & { quotations?: Array<Pick<Quotation, 'id' | 'quoteNumber' | 'status'>> };
  owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  projectManager?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
  members?: Array<{
    id: string;
    role: string;
    user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role'>;
  }>;
  milestones?: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    targetDate?: string | null;
    completedAt?: string | null;
    sortOrder: number;
  }>;
  deliverables?: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    dueDate?: string | null;
    completedAt?: string | null;
    sortOrder: number;
  }>;
  requirements?: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    notes?: string | null;
    completedAt?: string | null;
  }>;
  tasks?: Task[];
  documents?: LeadFlowDocument[];
  activityLogs?: ActivityLog[];
  _count?: {
    tasks: number;
    milestones: number;
    deliverables: number;
    requirements: number;
  };
}

export type DocumentType =
  | 'PROPOSAL'
  | 'STATEMENT_OF_WORK'
  | 'SERVICE_AGREEMENT'
  | 'NDA'
  | 'MAINTENANCE_AGREEMENT'
  | 'SAAS_SUBSCRIPTION_AGREEMENT'
  | 'CUSTOM';

export type DocumentStatus =
  | 'DRAFT'
  | 'READY'
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export interface DocumentTemplate {
  id: string;
  name: string;
  type: DocumentType;
  description?: string | null;
  content: string;
  isSystemTemplate: boolean;
  isActive: boolean;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  renderedContent: string;
  createdAt: string;
}

export interface LeadFlowDocument {
  id: string;
  dealId?: string | null;
  projectId?: string | null;
  contactId: string;
  templateId?: string | null;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  currentVersionId?: string | null;
  expiresAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
  deal?: Pick<Deal, 'id' | 'title' | 'stage'>;
  project?: Pick<Project, 'id' | 'name' | 'serviceType' | 'status'>;
  template?: DocumentTemplate | null;
  currentVersion?: DocumentVersion | null;
  versions?: DocumentVersion[];
  acceptances?: Array<{
    id: string;
    acceptedByName: string;
    acceptedByEmail: string;
    designation?: string | null;
    acceptedAt: string;
  }>;
}

export type DealOnboardingStatus =
  | 'NOT_STARTED'
  | 'LINK_CREATED'
  | 'SENT'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'COMPLETED';

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
  discountAmount?: number;
  taxableAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
  total?: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  provider?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  referenceNumber?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
  receipts?: Receipt[];
}

export interface Receipt {
  id: string;
  invoiceId: string;
  paymentId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  issuedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  quotationId?: string | null;
  contactId: string;
  dealId?: string | null;
  projectId?: string | null;
  companyId: string;
  status: string;
  currency?: string;
  issueDate: string;
  dueDate?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxPercent: number;
  taxMode?: string;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxVatAmount: number;
  total: number;
  totalAmount?: number;
  amountPaid: number;
  balanceDue: number;
  amountDue?: number;
  finalizedAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber' | 'phoneCountryCode' | 'email' | 'contactType' | 'companyName' | 'contactPersonName' | 'country' | 'addressLine1' | 'city' | 'state' | 'pincode' | 'postalCode' | 'gstin' | 'taxId'>;
  deal?: Pick<Deal, 'title' | 'stage'> | null;
  project?: Pick<Project, 'id' | 'name' | 'status'> | null;
  quotation?: Pick<Quotation, 'id' | 'quoteNumber' | 'status'> | null;
  items: InvoiceItem[];
  payments?: Payment[];
  receipts?: Receipt[];
  publicTokens?: Array<{ id: string; expiresAt?: string | null; lastViewedAt?: string | null; createdAt: string }>;
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
  onboarding?: ClientOnboardingPanel | null;
  project?: Project | null;
  documents?: LeadFlowDocument[];
  kickoffReadiness?: KickoffReadiness | null;
}

export interface ClientOnboardingPanel {
  isCode2CrestTenant: boolean;
  eligible: boolean;
  reason?: string | null;
  status: DealOnboardingStatus;
  template?: {
    id: string;
    name: string;
    status: string;
    systemKey?: string | null;
  } | null;
  latestLink?: {
    id: string;
    createdAt: string;
    expiresAt?: string | null;
    maxUses?: number | null;
    usedCount: number;
    isActive: boolean;
    url?: string | null;
  } | null;
  latestSubmission?: {
    id: string;
    status: FormSubmissionStatus;
    submittedAt: string;
    sections?: Array<{
      section: string;
      answers: Array<{
        key: string;
        label: string;
        value: unknown;
        displayValue: string;
      }>;
    }>;
  } | null;
  reminders?: Array<{
    id: string;
    reminderDay: number;
    channel: string;
    sentAt: string;
  }>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  status: string;
  variables?: string[];
}

export type FormStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type FormPurpose =
  | 'GENERAL'
  | 'CLIENT_ONBOARDING'
  | 'REQUIREMENTS'
  | 'LEAD_CAPTURE'
  | 'SURVEY'
  | 'FEEDBACK'
  | 'SERVICE_REQUEST';
export type FormFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'EMAIL'
  | 'PHONE'
  | 'NUMBER'
  | 'URL'
  | 'DATE'
  | 'SELECT'
  | 'MULTISELECT'
  | 'RADIO'
  | 'CHECKBOX'
  | 'BOOLEAN';
export type FormSubmissionStatus = 'RECEIVED' | 'REVIEWED' | 'COMPLETED';

export interface FormOption {
  label: string;
  value: string;
}

export interface LeadFlowFormField {
  id?: string;
  key: string;
  label: string;
  type: FormFieldType;
  placeholder?: string | null;
  helpText?: string | null;
  required: boolean;
  order: number;
  options?: FormOption[] | null;
  validation?: Record<string, unknown> | null;
}

export interface LeadFlowForm {
  id: string;
  name: string;
  slug: string;
  systemKey?: string | null;
  description?: string | null;
  status: FormStatus;
  purpose: FormPurpose;
  createdAt: string;
  updatedAt: string;
  fields?: LeadFlowFormField[];
  _count?: {
    fields: number;
    submissions: number;
  };
}

export interface PublicFormLink {
  id: string;
  formId: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  token?: string;
  url?: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'> | null;
  deal?: Pick<Deal, 'title' | 'stage'> | null;
}

export interface FormSubmission {
  id: string;
  formId: string;
  submittedByName?: string | null;
  submittedByEmail?: string | null;
  status: FormSubmissionStatus;
  submittedAt: string;
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber' | 'email'> | null;
  deal?: Pick<Deal, 'title' | 'stage'> | null;
  values?: Array<{
    id: string;
    value: unknown;
    field: LeadFlowFormField;
  }>;
  form?: LeadFlowForm;
  _count?: {
    values: number;
  };
}

export interface PublicFormPayload {
  form: Pick<LeadFlowForm, 'name' | 'description' | 'purpose'> & {
    systemKey?: string | null;
    isCode2CrestOnboarding?: boolean;
    fields: LeadFlowFormField[];
  };
  company: {
    name: string;
    logoUrl?: string | null;
  };
  prefill?: Record<string, unknown>;
}
