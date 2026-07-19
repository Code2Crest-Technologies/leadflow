# Deployment Notes

## Code2Crest Website Lead Intake

LeadFlow production needs two Railway variables for secure Code2Crest website lead forwarding:

```env
CODE2CREST_LEADFLOW_INTEGRATION_SECRET=replace-with-shared-server-secret
CODE2CREST_LEADFLOW_COMPANY_ID=replace-with-code2crest-leadflow-company-id
```

The Code2Crest website deployment needs matching server-only variables:

```env
LEADFLOW_INTERNAL_API_URL=https://lead-flow-backend-production-8976.up.railway.app
CODE2CREST_LEADFLOW_INTEGRATION_SECRET=replace-with-the-same-shared-server-secret
```

`LEADFLOW_INTERNAL_API_URL` should point to the LeadFlow backend origin, not the public frontend. The website should call:

```text
${LEADFLOW_INTERNAL_API_URL}/api/internal/leads/intake
```

Do not add the LeadFlow company id to website environment variables. Tenant resolution is owned by the LeadFlow backend.

## Neon/Railway Database Pooling

For pooled PostgreSQL connections, keep the production `DATABASE_URL` tuned for short serverless-style requests:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/lead_flow?schema=crm_user&connection_limit=5&pool_timeout=30&connect_timeout=15
```
