# Code2Crest Client Onboarding

Phase 5 adds a Code2Crest-only client onboarding workflow on top of the generic LeadFlow Forms module.

The generic Forms module remains reusable for other tenants and form purposes. The guided onboarding wizard is enabled only for forms with `systemKey = CODE2CREST_CLIENT_ONBOARDING`.

## Tenant configuration

Set the Code2Crest LeadFlow company id server-side:

```bash
CODE2CREST_LEADFLOW_COMPANY_ID=replace-with-code2crest-leadflow-company-id
FRONTEND_URL=https://leadflow.code2crest.com
```

Never pass or trust this company id from the browser.

## Bootstrap template

Run this after migrations and before beta use:

```bash
pnpm --filter lead-flow-backend bootstrap:code2crest-onboarding
```

The command is idempotent. It creates or safely updates the `CODE2CREST_CLIENT_ONBOARDING` form only inside the configured Code2Crest tenant.

## Workflow

1. Move a Code2Crest deal to `WON`.
2. Open the deal detail page and use the `Client Onboarding` tab.
3. Click `Start Client Onboarding` to create a 30-day, single-use public form link.
4. Copy the link and send it to the client.
5. Client completes the guided multi-step public onboarding form without a LeadFlow account.
6. LeadFlow links the submission to the existing contact and deal.
7. Internal users mark the onboarding as `UNDER_REVIEW` and then `COMPLETED`.

The workflow does not collect passwords, OTPs, bank credentials, payment gateway secrets, or API secret keys.

## Public form behavior

The public onboarding form is split into compact steps:

- Business
- Project
- Brand & Content
- Website Setup
- App / Software
- Maintenance
- Technical Access
- Review & Consent

Fields are shown based on `serviceType`:

- `Website Development`, `Web Application Development`, and `E-Commerce Solutions` show website/domain/hosting fields.
- `Mobile App Development`, `Custom Software Development`, and `SaaS / Product Development` show software/app fields.
- `Maintenance & Support` shows existing-system and support fields.
- Technical access questions are shown only when they are relevant to the selected service.

Server-side validation uses the same visibility rules. Hidden service-specific fields are ignored during persistence, and hidden required fields do not block submission.

## Submission safety

Public submissions are sanitized before Prisma writes nested `FormSubmissionValue` rows:

- `undefined`, `null`, blank strings, and empty arrays are omitted.
- `false` and `0` are preserved as real answers.
- Unknown field keys are rejected.
- Non-JSON-safe values are rejected before database persistence.

This prevents Prisma runtime failures caused by attempting to store `value: undefined`.

## Deal onboarding status

- Opening a valid onboarding link can move a deal from `LINK_CREATED` or `SENT` to `IN_PROGRESS`.
- Successful submission moves the deal to `SUBMITTED`.
- Internal review can move it to `UNDER_REVIEW`.
- Completion moves it to `COMPLETED`.

## Future enhancements

- Secure file uploads for brand assets and project documents.
- Branded email delivery for onboarding links.
