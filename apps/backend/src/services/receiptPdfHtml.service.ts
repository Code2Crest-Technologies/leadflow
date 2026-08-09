import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';

type ReceiptPdfData = {
  receiptNumber: string;
  amount: unknown;
  currency: string;
  issuedAt: Date | string;
  invoice: {
    invoiceNumber: string;
    company: { name: string; email?: string | null; phone?: string | null; gstin?: string | null };
    contact: {
      firstName: string;
      lastName?: string | null;
      companyName?: string | null;
      contactType?: string | null;
    };
  };
  payment: {
    method: string;
    referenceNumber?: string | null;
    providerPaymentId?: string | null;
    paidAt?: Date | string | null;
  };
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: unknown) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateText(value?: Date | string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function customerName(receipt: ReceiptPdfData) {
  const contact = receipt.invoice.contact;
  if (contact.contactType === 'COMPANY') return contact.companyName || contact.firstName;
  return `${contact.firstName} ${contact.lastName || ''}`.trim();
}

function buildReceiptHtml(receipt: ReceiptPdfData) {
  const title = `${receipt.receiptNumber} - Receipt`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
    @page { size: A4; margin: 0; }
    body { margin: 0; background: #F0EDE4; color: #10201D; font-family: Arial, Helvetica, sans-serif; }
    .sheet { width: 794px; min-height: 1123px; margin: 0 auto; background: #fff; padding: 46px; position: relative; }
    .header { display: flex; justify-content: space-between; gap: 40px; border-bottom: 1px solid #DDD8CD; padding-bottom: 24px; }
    h1 { margin: 0; color: #004741; font-size: 34px; letter-spacing: .08em; }
    .company { font-size: 18px; font-weight: 800; }
    .muted { color: #6B7A75; font-size: 12px; line-height: 1.6; }
    .amount { margin: 36px 0; border-radius: 20px; background: #F0EDE4; padding: 28px; text-align: center; }
    .amount span { color: #6B7A75; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
    .amount strong { display: block; margin-top: 10px; color: #004741; font-size: 42px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .card { border: 1px solid #DDD8CD; border-radius: 16px; padding: 18px; }
    .label { color: #004741; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .value { margin-top: 10px; font-size: 15px; font-weight: 700; }
    .footer { position: absolute; left: 46px; right: 46px; bottom: 34px; border-top: 1px solid #DDD8CD; padding-top: 12px; display: flex; justify-content: space-between; color: #6B7A75; font-size: 10px; }
  </style></head><body><main class="sheet">
    <section class="header">
      <div><div class="company">${escapeHtml(receipt.invoice.company.name)}</div><div class="muted">${escapeHtml(receipt.invoice.company.email || '')}<br />${escapeHtml(receipt.invoice.company.phone || '')}</div></div>
      <div style="text-align:right"><h1>RECEIPT</h1><div class="muted">${escapeHtml(receipt.receiptNumber)}<br />${escapeHtml(dateText(receipt.issuedAt))}</div></div>
    </section>
    <section class="amount"><span>Payment received</span><strong>${money(receipt.amount)}</strong></section>
    <section class="grid">
      <div class="card"><div class="label">Received From</div><div class="value">${escapeHtml(customerName(receipt))}</div><p class="muted">Against invoice ${escapeHtml(receipt.invoice.invoiceNumber)}</p></div>
      <div class="card"><div class="label">Payment Method</div><div class="value">${escapeHtml(receipt.payment.method.replace('_', ' '))}</div><p class="muted">Reference: ${escapeHtml(receipt.payment.referenceNumber || receipt.payment.providerPaymentId || 'Manual entry')}<br />Paid on ${escapeHtml(dateText(receipt.payment.paidAt))}</p></div>
    </section>
    <div class="footer"><div>Thank you for your payment.</div><div>Generated using LeadFlow CRM</div></div>
  </main></body></html>`;
}

export async function generateReceiptPdfHtml(receipt: ReceiptPdfData) {
  const title = `${receipt.receiptNumber} - Receipt`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(buildReceiptHtml(receipt), { waitUntil: 'load' });
    await page.evaluate((documentTitle) => {
      document.title = documentTitle;
    }, title);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    const doc = await PDFDocument.load(pdf);
    doc.setTitle(title);
    doc.setAuthor(receipt.invoice.company.name);
    doc.setSubject('Payment Receipt');
    doc.setCreator('LeadFlow CRM');
    doc.setProducer('LeadFlow CRM');
    return Buffer.from(await doc.save());
  } finally {
    await browser.close();
  }
}
