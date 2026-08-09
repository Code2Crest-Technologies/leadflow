import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const root = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Phase 9 billing and payments foundation', () => {
  it('adds production billing/payment models to Prisma schema', () => {
    const schema = read('prisma/schema.prisma');

    expect(schema).toContain('model BillingProfile');
    expect(schema).toContain('model InvoicePublicToken');
    expect(schema).toContain('model PaymentMilestone');
    expect(schema).toContain('model Payment');
    expect(schema).toContain('model Receipt');
    expect(schema).toContain('model PaymentReminderLog');
    expect(schema).toContain('enum InvoiceTaxMode');
    expect(schema).toContain('enum PaymentMethod');
    expect(schema).toContain('projectId     String?');
    expect(schema).toContain('billingSnapshot Json?');
  });

  it('exposes protected and public invoice billing routes', () => {
    const invoiceRoutes = read('src/routes/invoices.routes.ts');
    const publicRoutes = read('src/routes/public-invoices.routes.ts');
    const app = read('src/app.ts');

    expect(invoiceRoutes).toContain("router.get('/billing/profile'");
    expect(invoiceRoutes).toContain("router.get('/milestones'");
    expect(invoiceRoutes).toContain("router.post('/milestones'");
    expect(invoiceRoutes).toContain("router.post('/:id/finalize'");
    expect(invoiceRoutes).toContain("router.post('/:id/send'");
    expect(invoiceRoutes).toContain("router.post('/:id/link'");
    expect(invoiceRoutes).toContain("router.post('/:id/payment/razorpay'");
    expect(invoiceRoutes).toContain("router.get('/:id/receipts/:receiptId/pdf'");
    expect(publicRoutes).toContain("router.get('/:token'");
    expect(publicRoutes).toContain("router.get('/:token/pdf'");
    expect(app).toContain("app.use('/api/public/invoices', publicInvoiceRoutes)");
  });

  it('keeps Razorpay in test mode with signature verification', () => {
    const billingService = read('src/services/billing.service.ts');

    expect(billingService).toContain("process.env.RAZORPAY_MODE || 'test'");
    expect(billingService).toContain('Razorpay live mode is disabled');
    expect(billingService).toContain("createHmac('sha256', keySecret)");
    expect(billingService).toContain('crypto.timingSafeEqual');
  });

  it('connects advance payment readiness to project kickoff', () => {
    const projectService = read('src/services/projectKickoff.service.ts');

    expect(projectService).toContain("import { getAdvancePaymentReadiness } from './billing.service.js'");
    expect(projectService).toContain('const advancePaymentReadiness = await getAdvancePaymentReadiness');
    expect(projectService).toContain('status: advancePaymentReadiness.status');
  });
});
