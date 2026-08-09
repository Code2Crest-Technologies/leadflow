import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Phase 10 WhatsApp communication foundation', () => {
  it('extends existing communication models instead of adding duplicate message tables', () => {
    const schema = read('prisma/schema.prisma');

    expect(schema).toContain('model Conversation');
    expect(schema).toContain('dealId         String?');
    expect(schema).toContain('serviceWindowEndsAt DateTime?');
    expect(schema).toContain('unreadCount    Int');
    expect(schema).toContain('model Message');
    expect(schema).toContain('providerMessageId String?');
    expect(schema).toContain('providerStatus    String?');
    expect(schema).toContain('model CommunicationSettings');
    expect(schema).toContain('model WebhookEvent');
    expect(schema).not.toContain('model WhatsAppConversation');
  });

  it('adds secure Meta WhatsApp webhook routes', () => {
    const app = read('src/app.ts');
    const route = read('src/routes/meta-webhooks.routes.ts');
    const validation = read('src/middleware/validation.ts');

    expect(app).toContain("app.use('/api/webhooks/meta', metaWebhookRoutes)");
    expect(route).toContain("router.get('/whatsapp'");
    expect(route).toContain("router.post('/whatsapp', validateWebhookSignature");
    expect(validation).toContain('META_WHATSAPP_APP_SECRET');
    expect(validation).toContain('x-hub-signature-256');
    expect(validation).toContain('timingSafeEqual');
  });

  it('uses tenant lookup, idempotency, phone normalization, and service window logic', () => {
    const service = read('src/services/whatsappCloud.service.ts');

    expect(service).toContain("const PROVIDER = 'META_WHATSAPP'");
    expect(service).toContain('resolveIntegrationByPhoneNumberId');
    expect(service).toContain('phoneNumberId');
    expect(service).toContain('prisma.webhookEvent.upsert');
    expect(service).toContain('normalizePhoneToE164');
    expect(service).toContain('serviceWindowEndsAt');
    expect(service).toContain('SERVICE_WINDOW_CLOSED');
    expect(service).toContain('WHATSAPP_OPTED_OUT');
  });

  it('supports outbound text, templates, deal linking, and connection testing', () => {
    const route = read('src/routes/conversations.routes.ts');
    const service = read('src/services/whatsappCloud.service.ts');

    expect(route).toContain("router.post('/:id/messages'");
    expect(route).toContain("router.post('/:id/messages/template'");
    expect(route).toContain("router.patch('/:id/deal'");
    expect(route).toContain("router.post('/whatsapp/test-connection'");
    expect(service).toContain('sendWhatsAppText');
    expect(service).toContain('sendWhatsAppTemplate');
    expect(service).toContain('renderTemplate');
    expect(service).toContain('testWhatsAppConnection');
  });

  it('adds conservative communication automation boundary and documentation', () => {
    const automation = read('src/services/communicationAutomation.service.ts');
    const docs = read('../../docs/WHATSAPP_COMMUNICATION.md');

    expect(automation).toContain('ONBOARDING_LINK_READY');
    expect(automation).toContain('INVOICE_SENT');
    expect(automation).toContain('PROJECT_STARTED');
    expect(automation).toContain('AUTOMATION_DISABLED');
    expect(docs).toContain('24-Hour Service Window');
    expect(docs).toContain('Tenant Resolution');
    expect(docs).toContain('Webhook Endpoints');
  });
});
