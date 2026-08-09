# LeadFlow WhatsApp Cloud API & Communication Automation

Phase 10 adds a multi-tenant WhatsApp communication layer on top of the existing LeadFlow Conversation, Message, MessageTemplate, Contact, Deal, Integration, and ActivityLog models.

## Architecture

LeadFlow does not create separate WhatsApp-only conversation tables. WhatsApp is represented as a channel inside the existing communication model:

- `Integration` stores tenant WhatsApp connection metadata.
- `Conversation` stores the CRM thread.
- `Message` stores inbound, outbound, provider IDs, statuses, media metadata, and failures.
- `MessageTemplate` stores WhatsApp template metadata/status.
- `CommunicationSettings` stores conservative/off-by-default automation settings.
- `WebhookEvent` stores webhook idempotency records.

## Environment Variables

```env
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WHATSAPP_APP_SECRET=
META_WHATSAPP_VERIFY_TOKEN=
META_GRAPH_API_VERSION=v20.0
PUBLIC_BACKEND_URL=
```

Never commit real Meta tokens.

## Webhook Endpoints

Meta WhatsApp Cloud API should use:

```txt
GET  /api/webhooks/meta/whatsapp
POST /api/webhooks/meta/whatsapp
```

The GET route validates:

- `hub.mode`
- `hub.verify_token`
- `hub.challenge`

The POST route validates `x-hub-signature-256` with the configured app secret before processing.

## Tenant Resolution

Inbound webhooks are resolved by trusted provider identifiers:

- `phone_number_id`
- WhatsApp Business Account ID where available

LeadFlow never trusts a company ID from a webhook payload.

## Inbound Processing

Inbound messages:

- normalize phone numbers to E.164
- match contacts by normalized phone or WhatsApp ID
- safely create unknown WhatsApp contacts
- reuse one WhatsApp conversation per company/contact
- dedupe by provider message ID
- update `lastInboundAt` and `serviceWindowEndsAt`
- increment unread count
- store media metadata without treating temporary Meta media URLs as permanent storage

## Status Updates

Webhook statuses update outbound messages:

- `sent`
- `delivered`
- `read`
- `failed`

Status updates cannot downgrade a later state such as `READ` back to `DELIVERED`.

## 24-Hour Service Window

Free-form WhatsApp text is allowed only when:

```txt
serviceWindowEndsAt > now
```

Outside the window, LeadFlow blocks free-form text and requires an approved WhatsApp template.

## Templates

LeadFlow reflects Meta template status. It does not approve templates itself.

Variables are validated before send. LeadFlow will not send unresolved placeholders like `{{client_name}}`.

## Automations

Communication automations are conservative/off by default:

- new lead acknowledgement
- onboarding link
- onboarding reminder
- document sent
- invoice sent
- payment reminders
- payment confirmation
- project kickoff

The current implementation provides a clean service boundary for these triggers without building a full workflow builder.

## Opt-Out

When a contact replies `STOP`, LeadFlow records WhatsApp opt-out status and prevents configured automated WhatsApp sends.

## Security

- All conversation/message/template operations are company-scoped.
- Webhooks require Meta signature validation.
- Provider IDs from frontend are not trusted as tenant authority.
- Access tokens are not returned to frontend.
- Send endpoints return safe errors, not raw credentials.

## Future Channels

The schema remains channel-based for future Instagram and Facebook Messenger work, but Phase 10 implements WhatsApp only.
