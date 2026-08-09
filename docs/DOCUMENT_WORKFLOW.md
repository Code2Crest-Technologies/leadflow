# LeadFlow Document Workflow

Phase 8 adds lightweight, secure, versioned client-facing documents.

Supported document types:

- Proposal
- Statement of Work
- Service Agreement
- NDA
- Maintenance Agreement
- SaaS Subscription Agreement
- Custom

LeadFlow does not implement a full legal e-signature or enterprise document-management platform.

## Data Model

Core models:

- `DocumentTemplate`
- `Document`
- `DocumentVersion`
- `DocumentPublicToken`
- `DocumentAcceptance`

Documents can link to:

- Deal
- Project
- Contact
- Template

Versions are immutable once a document is sent/viewed/accepted. Revisions create a new `DocumentVersion`.

## Lifecycle

Statuses:

- `DRAFT`
- `READY`
- `SENT`
- `VIEWED`
- `ACCEPTED`
- `REJECTED`
- `EXPIRED`
- `SUPERSEDED`
- `CANCELLED`

Typical flow:

1. Create document from a Deal or Project.
2. Render version 1 from a template.
3. Review/edit draft.
4. Mark ready.
5. Send to client or copy secure review link.
6. Client views public document.
7. Client accepts or rejects that exact version.
8. Internal user creates a revision if needed.

## Templates

Templates support deterministic merge variables:

- `{{client_name}}`
- `{{client_company}}`
- `{{client_email}}`
- `{{client_phone}}`
- `{{project_name}}`
- `{{service_type}}`
- `{{deal_title}}`
- `{{quotation_number}}`
- `{{quotation_amount}}`
- `{{project_start_date}}`
- `{{project_target_date}}`
- `{{payment_terms}}`
- `{{company_name}}`
- `{{company_email}}`
- `{{company_website}}`

Unknown variables remain visible. `Mark Ready` fails if unresolved variables remain.

## Code2Crest Templates

LeadFlow bootstraps Code2Crest templates per tenant:

- Proposal
- Statement of Work
- Service Agreement
- NDA
- Maintenance Agreement
- SaaS Subscription Agreement

Legal disclaimer:

Legal document templates should be reviewed by qualified legal counsel before production use.

System templates are not directly editable. Admins clone them and customize the clone.

## Public Tokens

Public review links use cryptographically random tokens.

Only the SHA-256 token hash is stored.

Tokens support:

- expiry
- invalidation
- view counting
- version binding

A client can only accept the exact current version linked by the token.

## Acceptance

Acceptance is a lightweight acknowledgement, not a cryptographic digital signature.

Acceptance records store:

- document ID
- version ID
- accepted name
- accepted email
- optional designation
- acceptance text
- accepted date

Duplicate acceptance for the same document/version is idempotent.

## Rejection

Clients can reject/request changes with a required reason.

Rejected versions remain in history. Internal users create a revision instead of overwriting the rejected version.

## PDF

PDFs are generated from `DocumentVersion.renderedContent`.

Accepted PDFs include an acceptance summary section.

## Kickoff Readiness

Project kickoff readiness now checks accepted documents:

- accepted `SERVICE_AGREEMENT` or accepted `STATEMENT_OF_WORK` => passed
- draft/sent/viewed document => warning
- rejected/expired/cancelled document => failed warning state
- no agreement/SOW => warning by default

The policy is intentionally warning-first for this phase. It can become mandatory per tenant later.

## Security

Every internal query is scoped by `companyId`.

Public responses do not expose database IDs, internal notes, company IDs, or activity logs.

Tenant HTML content is sanitized before storage/rendering to remove scripts and event handlers.

## Routes

Internal:

- `GET /api/documents/templates`
- `POST /api/documents/templates`
- `POST /api/documents/templates/:id/clone`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `PATCH /api/documents/:id`
- `POST /api/documents/:id/revisions`
- `POST /api/documents/:id/ready`
- `POST /api/documents/:id/send`
- `POST /api/documents/:id/link`
- `POST /api/documents/:id/cancel`
- `GET /api/documents/:id/pdf`

Public:

- `GET /api/public/documents/:token`
- `GET /api/public/documents/:token/pdf`
- `POST /api/public/documents/:token/accept`
- `POST /api/public/documents/:token/reject`

## Deployment

Apply migration:

```bash
cd apps/backend
npx prisma migrate deploy
npx prisma generate
```

## WhatsApp Automation Integration

Phase 10 adds a WhatsApp sharing boundary for documents. Admins can enable document communication per tenant, and LeadFlow should use approved templates containing client name, document title, project name, secure review link, and expiry. Internal token values must not be logged or exposed.
