# Code2Crest Client Onboarding

Phase 5 adds a Code2Crest-only client onboarding workflow on top of the generic LeadFlow Forms module.

The generic Forms module remains reusable for other tenants and form purposes. The guided onboarding wizard is enabled only for forms with `systemKey = CODE2CREST_CLIENT_ONBOARDING`.

## Tenant configuration

Set the Code2Crest LeadFlow company id server-side:

```bash
CODE2CREST_LEADFLOW_COMPANY_ID=replace-with-code2crest-leadflow-company-id
FRONTEND_URL=https://leadflow.code2crest.com
CODE2CREST_ONBOARDING_BASE_URL=https://www.code2crest.com/onboarding
RESEND_API_KEY=replace-with-resend-api-key
RESEND_FROM="Code2Crest Technologies <hello@code2crest.com>"
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
4. Send the link by Email, copy it, or share it through WhatsApp.
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

## Automation

Phase 6 adds operational actions to the Deal onboarding tab:

- `Send Client Onboarding` creates a fresh secure onboarding URL and sends a branded Code2Crest email through Resend when `RESEND_API_KEY` is configured.
- `Copy Link` creates a fresh copyable URL and writes it to the browser clipboard.
- `Share via WhatsApp` creates a fresh secure URL and opens `wa.me` with a prefilled Code2Crest message.
- `Regenerate Link` invalidates old active tokens and creates a fresh token.
- `Download Onboarding PDF` exports saved responses as a sectioned PDF generated from database values.

Raw public tokens are never stored. If an older link needs to be copied after a page reload, LeadFlow invalidates the previous active token and creates a fresh one.

## Reminder flow

Reminder history is stored in `ClientOnboardingReminder`.

Default reminder days:

- 3 days
- 7 days
- 14 days

Reminders run only for deals with `onboardingStatus = SENT` or `IN_PROGRESS` and no onboarding submission. A unique database constraint on `companyId + dealId + reminderDay` prevents duplicate reminders.

Run reminders from a scheduled job instead of the web application request cycle. Recommended production schedule:

```cron
0 9 * * *
```

Command:

```bash
cd apps/backend
pnpm cron:client-onboarding-reminders
```

The cron job resolves the configured Code2Crest tenant from `CODE2CREST_LEADFLOW_COMPANY_ID`, finds due reminders, sends only the next unsent reminder day, and records the reminder before the next run can duplicate it.

## Notifications and timeline

LeadFlow logs timeline events for:

- Onboarding link created
- Onboarding email sent
- WhatsApp link shared
- Reminder sent
- Client opened form
- Client submitted
- Review started
- Completed

On submission, active admins/managers and the deal assignee receive an internal notification email when email delivery is configured. Without email credentials, LeadFlow logs the queued/skipped delivery safely.

## Metrics

The dashboard summary includes Code2Crest onboarding metrics when the current tenant is the configured Code2Crest company:

- Sent
- In progress
- Submitted
- Completed
- Reminder count
- Completion percentage
- Average completion hours

## Future enhancements

- Secure file uploads for brand assets and project documents.

## WhatsApp Automation Integration

Phase 10 adds a WhatsApp automation boundary for onboarding links and reminders. The automation remains off by default per tenant. When enabled, LeadFlow should send approved WhatsApp templates only, using variables such as client name, project name, and the secure onboarding link. Reminders stop once onboarding is submitted or completed.
