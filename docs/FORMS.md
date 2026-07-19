# LeadFlow Forms Foundation

LeadFlow Forms is a reusable, multi-tenant form module for every company workspace. It is intentionally generic so it can support client onboarding, requirement collection, lead capture, site surveys, feedback, and service requests without becoming Code2Crest-specific.

## Architecture

- Authenticated management API: `/api/forms`
- Public form API: `/api/public/forms/:token`
- Public form page: `/forms/:token`
- Dashboard UI:
  - `/dashboard/forms`
  - `/dashboard/forms/new`
  - `/dashboard/forms/:id`
  - `/dashboard/forms/:id/edit`
  - `/dashboard/forms/:id/submissions`

## Data Model

Core tables:

- `Form`
- `FormField`
- `FormSubmission`
- `FormSubmissionValue`
- `PublicFormToken`

`PublicFormToken` stores only a SHA-256 token hash. The raw token is returned once when a public link is created.

Supported field types:

- `TEXT`
- `TEXTAREA`
- `EMAIL`
- `PHONE`
- `NUMBER`
- `URL`
- `DATE`
- `SELECT`
- `MULTISELECT`
- `RADIO`
- `CHECKBOX`
- `BOOLEAN`

File upload is intentionally not implemented in this phase.

## Permissions

Current LeadFlow roles map to Forms permissions as:

- `ADMIN`: full access
- `MANAGER`: read/create/update/publish/submissions
- `AGENT`: read forms and submissions

Permissions added:

- `forms.read`
- `forms.create`
- `forms.update`
- `forms.delete`
- `forms.publish`
- `forms.submissions.read`

## Multi-Tenant Isolation

All authenticated form queries are scoped by `req.auth.companyId`.

Public form submissions do not accept `companyId`, `formId`, `contactId`, or `dealId` from the browser. The token resolves the company, form, and optional contact/deal association server-side.

A form or submission belonging to Company A cannot be accessed through Company B credentials because every management route performs company-scoped lookup.

## Public Token Security

Public links are generated through:

```http
POST /api/forms/:id/public-links
```

Options:

- `expiresAt`
- `maxUses`
- `contactId`
- `dealId`

Associations are validated inside the authenticated company before the token is created. The public browser receives only the raw token link and never submits internal CRM IDs.

## Submission Flow

1. Authenticated user creates or publishes a form.
2. Authenticated user creates a public link.
3. LeadFlow stores only `tokenHash`.
4. Visitor opens `/forms/:token`.
5. Backend validates token active state, expiry, max uses, and form `ACTIVE` status.
6. Visitor submits values.
7. Backend validates required fields, type rules, options, and rejects unknown fields.
8. Submission values are stored.
9. `FORM_SUBMITTED` activity is logged, linked to contact/deal when the token has those associations.

## Validation

Server-side validation supports:

- text length limits
- textarea length limits
- email format
- phone format
- number min/max
- URL format
- date parsing
- select/radio allowed option matching
- multiselect allowed option matching
- checkbox/boolean validation

## Activity Logging

Activity types:

- `FORM_CREATED`
- `FORM_UPDATED`
- `FORM_PUBLISHED`
- `FORM_ARCHIVED`
- `FORM_LINK_CREATED`
- `FORM_SUBMITTED`
- `FORM_SUBMISSION_REVIEWED`
- `FORM_SUBMISSION_COMPLETED`

Activity metadata includes safe details only: form name, form id, submission id, and purpose. Full form submission content is not copied into activity metadata.

## Future Code2Crest Onboarding

This foundation can later power a `CLIENT_ONBOARDING` template for Code2Crest without schema changes. Future fields can cover company info, project info, branding, content, requirements, and timeline.

No Code2Crest-specific template is seeded in Phase 4.

## Future File Upload Plan

Do not store binary files in PostgreSQL.

Future uploads should use:

- S3/R2/blob storage
- signed upload URLs
- file size limits
- file type allowlists
- malware scanning if needed
- submission value references to uploaded asset metadata

## Production Migration

Development:

```bash
cd apps/backend
npx prisma validate
npx prisma generate
npx prisma migrate dev --name forms_foundation
```

Production:

```bash
cd apps/backend
npx prisma migrate deploy
```
