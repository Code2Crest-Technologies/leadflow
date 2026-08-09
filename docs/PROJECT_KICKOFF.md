# LeadFlow Project Kickoff

Phase 7 adds a lightweight sales-to-delivery handoff layer to LeadFlow.

LeadFlow owns:

- Sales
- Client onboarding
- Kickoff readiness
- Project creation
- Delivery handoff

LeadFlow does not become a full project management system. Detailed execution can later move to ProjectFlow through the handoff boundary.

## Lifecycle

Projects are created from completed sales.

Required source state:

- Deal stage is `WON`
- Deal onboarding status is `COMPLETED`
- Client onboarding submission exists
- Deal has a contact

Project statuses:

- `DRAFT`
- `READY_FOR_KICKOFF`
- `ACTIVE`
- `ON_HOLD`
- `CLIENT_REVIEW`
- `COMPLETED`
- `CANCELLED`

Valid transitions are enforced in `projectKickoff.service.ts`.

## Kickoff Readiness

The readiness service returns:

- `ready`
- `blockers`
- `warnings`
- structured `checks`

Hard blockers:

- missing deal
- deal not won
- onboarding not completed
- missing onboarding submission
- missing contact

Visible non-blocking checks:

- quotation approval
- agreement / SOW acceptance
- advance payment

Agreement / SOW readiness is powered by Phase 8 documents. An accepted `SERVICE_AGREEMENT` or `STATEMENT_OF_WORK` passes the check. Draft/sent/viewed documents remain warnings. Rejected/expired/cancelled documents indicate revision is needed.

Advance-payment checks are still placeholders with `NOT_CONFIGURED`, ready for later phases.

## Project Creation

Endpoint:

```http
POST /api/projects/deals/:dealId
```

The endpoint is idempotent. Because `Project.dealId` is unique, one deal can create only one project.

Project creation generates:

- project record
- project brief from deal/contact/onboarding submission
- default milestones
- default deliverables
- starter tasks using the existing `Task` model
- asset/access requirements checklist
- project creation activity

Admin readiness override requires an explicit reason and logs `PROJECT_KICKOFF_READINESS_OVERRIDE`.

## Project Brief

The brief is deterministic. It is generated from:

- Deal
- Contact
- Client onboarding submission values

It stores:

- human-readable `brief`
- structured JSON `briefData`

No AI generation is used in this phase.

## Templates

Milestone and task templates vary by service type:

- Website
- Web application / SaaS
- Maintenance
- General fallback

Generated tasks remain editable because they are normal LeadFlow tasks linked with `projectId`.

## Assets & Access

Generated checklist examples:

- Logo
- Brand Guidelines
- Website Content
- Product Images
- Domain Access
- Hosting Access
- Google Analytics Access
- Search Console Access
- Meta Business Access

Important rule:

Do not store passwords, OTPs, banking credentials, or secret API keys in LeadFlow. Use approved secure access-sharing methods.

## Commercial Readiness

The project workspace displays:

- Quotation: existing quotation metadata when available
- Agreement / SOW: accepted/pending/revision-needed document status from Phase 8
- Advance Payment: `NOT_CONFIGURED`

Billing, payment verification, and e-signature are intentionally not implemented in this phase.

## Kickoff Email

When a project moves to `ACTIVE`, LeadFlow attempts to send a branded kickoff email through the existing email service.

Email failure does not roll back project activation. The attempt is logged through activity logs.

## Activity Timeline

Project actions use existing `ActivityLog`.

Logged events include:

- Project created
- Kickoff readiness override
- Project manager assigned
- Team member added/removed
- Project started
- Project put on hold/resumed
- Client review started
- Project completed/cancelled
- Kickoff email sent/skipped/failed

## Permissions

Current role mapping:

- `ADMIN`: create projects, override readiness, assign team, cancel projects
- `MANAGER`: create/manage projects, assign PM/team, transition normal statuses
- `AGENT`: view assigned projects through ownership, membership, or assigned deal

Every query is scoped by `companyId`.

## ProjectFlow Boundary

The service function:

```ts
createProjectHandoffPayload(auth, projectId)
```

returns a future-safe payload containing:

- company
- client
- project
- deal
- brief
- team
- milestones
- tasks
- requirements
- deliverables

It does not send data to ProjectFlow yet.

## Deployment

Apply the Prisma migration:

```bash
cd apps/backend
npx prisma migrate deploy
npx prisma generate
```

Then build:

```bash
cd D:\lead-flow
pnpm -r build
```

## WhatsApp Automation Integration

Phase 10 adds an optional project kickoff WhatsApp template path. When a project becomes active and the tenant has enabled kickoff communication, LeadFlow can send an approved template with client name, project name, project manager, and start date.
