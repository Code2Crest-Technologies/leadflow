# Database Schema

## Overview

The WhatsApp CRM uses PostgreSQL with Prisma ORM. The schema includes models for:
- User management and authentication
- Contact and conversation management
- Message history and templates
- Sales pipeline (deals)
- Team members and permissions
- Activity logging
- Integrations

## Core Models

### User
```
- id: String (Primary Key)
- email: String (Unique)
- passwordHash: String
- firstName, lastName: String
- avatar: String?
- company: Company (FK)
- role: UserRole (ADMIN, MANAGER, AGENT)
- status: UserStatus (ACTIVE, INACTIVE, SUSPENDED)
- lastLoginAt: DateTime?
- createdAt, updatedAt: DateTime
```

### Company
```
- id: String (Primary Key)
- name: String
- website: String?
- industry: String?
- logo: String?
- whatsappPhoneNumber: String (Unique)
- whatsappBusinessAccountId: String (Unique)
- whatsappAccessToken: String (Encrypted)
- metaAdsAccountId: String?
- subscriptionTier: String (starter, pro, enterprise)
- maxUsers: Int
- maxContacts: Int
- createdAt, updatedAt: DateTime
```

### Contact
```
- id: String (Primary Key)
- company: Company (FK)
- phoneNumber: String
- email: String?
- firstName, lastName: String
- avatar: String?
- segment: ContactSegment (PROSPECT, LEAD, CUSTOMER, VIP, CHURNED)
- status: ContactStatus (ACTIVE, INACTIVE, BLOCKED, LOST)
- whatsappContactId: String?
- metaLeadId: String? (From Meta Ads)
- metaLeadData: Json?
- customFields: Json?
- lastContactedAt, lastMessageAt: DateTime?
- totalSpent: Decimal
- createdAt, updatedAt: DateTime
- Unique constraint: [companyId, phoneNumber]
```

### Conversation
```
- id: String (Primary Key)
- contact: Contact (FK)
- company: Company (FK)
- assignedTo: User? (FK)
- status: ConversationStatus (OPEN, CLOSED, ARCHIVED, WAITING)
- subject: String?
- messageCount: Int
- lastMessageAt: DateTime?
- whatsappConvId: String?
- createdAt, updatedAt: DateTime
- Unique constraint: [companyId, contactId]
```

### Message
```
- id: String (Primary Key)
- contact: Contact (FK)
- conversation: Conversation (FK)
- sender: User? (FK, null for inbound)
- company: Company (FK)
- direction: MessageDirection (INBOUND, OUTBOUND)
- messageType: MessageType (TEXT, IMAGE, DOCUMENT, TEMPLATE, VIDEO, AUDIO)
- content: String
- mediaUrl, mediaType: String?
- whatsappMessageId, whatsappStatusId: String?
- status: MessageStatus (PENDING, SENT, DELIVERED, READ, FAILED)
- deliveredAt, readAt: DateTime?
- failureReason: String?
- templateId: String?
- createdAt, updatedAt: DateTime
```

### MessageTemplate
```
- id: String (Primary Key)
- company: Company (FK)
- createdBy: User? (FK)
- name: String
- category: TemplateCategory (GREETING, SUPPORT, SALES, FOLLOW_UP, GENERAL, PROMOTIONAL)
- content: String
- variables: String[]
- whatsappTemplateId, whatsappTemplateCode: String?
- status: TemplateStatus (PENDING, APPROVED, REJECTED, DISABLED)
- approvalMessage: String?
- language: String (default: "en")
- createdAt, updatedAt: DateTime
- deletedAt: DateTime?
- Unique constraint: [companyId, whatsappTemplateId]
```

### Deal
```
- id: String (Primary Key)
- contact: Contact (FK)
- company: Company (FK)
- assignedTo: User (FK)
- title, description: String
- value: Decimal
- currency: String (default: USD)
- stage: DealStage (PROSPECT, QUALIFICATION, PROPOSAL, NEGOTIATION, WON, LOST)
- probability: Int (0-100)
- source: String (manual, whatsapp, email, ads_lead)
- createdAt, updatedAt: DateTime
- closedAt: DateTime?
```

### TeamMember
```
- id: String (Primary Key)
- company: Company (FK)
- user: User (FK)
- role: UserRole
- permissions: String[]
- createdAt, updatedAt: DateTime
- Unique constraint: [companyId, userId]
```

### ActivityLog
```
- id: String (Primary Key)
- company: Company (FK)
- eventType: String
- contact: Contact? (FK, nullable)
- user: User? (FK, nullable)
- metadata: Json?
- createdAt: DateTime
```

### Integration
```
- id: String (Primary Key)
- company: Company (FK)
- type: String (meta_ads, stripe, zapier, etc.)
- name: String
- accessToken, refreshToken: String? (Encrypted)
- config: Json?
- status: String (connected, disconnected)
- lastSyncAt: DateTime?
- createdAt, updatedAt: DateTime
- Unique constraint: [companyId, type]
```

## Indexes

Indexes are created on:
- User: companyId, email
- Company: name, whatsappPhoneNumber
- Contact: companyId, segment, status, metaLeadId
- Conversation: companyId, assignedToId, status
- Message: contactId, conversationId, companyId, senderId, whatsappMessageId, status, createdAt
- MessageTemplate: companyId, status
- CampaignTemplate: companyId, status, scheduledFor
- Deal: contactId, companyId, assignedToId, stage
- TeamMember: companyId, userId
- ActivityLog: companyId, contactId, userId, eventType, createdAt

## Enums

### UserRole
- ADMIN
- MANAGER
- AGENT

### ContactSegment
- PROSPECT
- LEAD
- CUSTOMER
- VIP
- CHURNED

### MessageStatus
- PENDING
- SENT
- DELIVERED
- READ
- FAILED

### DealStage
- PROSPECT
- QUALIFICATION
- PROPOSAL
- NEGOTIATION
- WON
- LOST

## Migrations

Migrations are stored in `apps/backend/prisma/migrations/`.

### Run Migrations
```bash
pnpm prisma migrate deploy
```

### Create New Migration
```bash
pnpm prisma migrate dev --name add_new_field
```

### Seed Database
```bash
pnpm prisma db seed
```
