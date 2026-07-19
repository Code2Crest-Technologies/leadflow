# Code2Crest Client Onboarding

Phase 5 adds a Code2Crest-only client onboarding workflow on top of the generic LeadFlow Forms module.

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
5. Client submits the public form without a LeadFlow account.
6. LeadFlow links the submission to the existing contact and deal.
7. Internal users mark the onboarding as `UNDER_REVIEW` and then `COMPLETED`.

The workflow does not collect passwords, OTPs, bank credentials, payment gateway secrets, or API secret keys.

## Future enhancements

- Conditional form fields by service type.
- Secure file uploads for brand assets and project documents.
- Branded email delivery for onboarding links.
