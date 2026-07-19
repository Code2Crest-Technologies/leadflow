# Lead Capture

LeadFlow accepts qualified Code2Crest website leads through a server-to-server internal endpoint.

## Internal Intake Endpoint

```http
POST /api/internal/leads/intake
Authorization: Bearer <CODE2CREST_LEADFLOW_INTEGRATION_SECRET>
Content-Type: application/json
```

The endpoint is intentionally not tied to the logged-in CRM session. It is protected by a shared server secret and resolves the Code2Crest tenant from `CODE2CREST_LEADFLOW_COMPANY_ID`.

Never send `companyId`, `tenantId`, or workspace identifiers from the website request body.

## Payload

```json
{
  "name": "Jane Doe",
  "companyName": "Acme Pvt Ltd",
  "email": "jane@example.com",
  "phone": "+919524899042",
  "service": "Website development",
  "budget": "Rs. 50,000 - Rs. 1,00,000",
  "timeline": "This month",
  "projectDescription": "Need a company website with quotation workflow.",
  "heardAboutUs": "Google",
  "attribution": {
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "website_leads",
    "utmTerm": "crm website",
    "utmContent": "hero_cta",
    "referrer": "https://google.com",
    "landingPage": "https://code2crest.com",
    "currentPage": "https://code2crest.com/#get-quote"
  }
}
```

Either `email` or `phone` is required.

## CRM Behavior

- Source is set internally as `CODE2CREST_GET_QUOTE`.
- Contact matching checks normalized email first, then phone within the configured company.
- Existing contacts are updated only with non-empty values and missing details are filled without overwriting existing data with blanks.
- A deal is created in `PROSPECT` stage with source `CODE2CREST_GET_QUOTE`, `INR` currency, and 10% initial probability.
- Duplicate suppression reuses the most recent open deal for the same contact and service if it was created in the previous 30 minutes.
- Every intake creates a `WEBSITE_LEAD_CAPTURED` activity log with safe metadata.

## Response

```json
{
  "success": true,
  "data": {
    "contactId": "contact_id",
    "dealId": "deal_id",
    "duplicateReused": false
  }
}
```

## Required LeadFlow Environment

```env
CODE2CREST_LEADFLOW_INTEGRATION_SECRET=shared-secret-used-by-the-website-server
CODE2CREST_LEADFLOW_COMPANY_ID=internal-code2crest-company-id
```

Use the internal LeadFlow company id from the production database. Do not expose it in client-side website code.
