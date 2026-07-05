import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';

type InvoicePdfData = {
  invoiceNumber: string;
  status: string;
  issueDate: Date | string;
  dueDate?: Date | string | null;
  paymentTerms?: string | null;
  terms?: string | null;
  subtotal: unknown;
  taxPercent: unknown;
  cgstAmount: unknown;
  sgstAmount: unknown;
  igstAmount: unknown;
  taxVatAmount: unknown;
  total: unknown;
  amountPaid: unknown;
  balanceDue: unknown;
  company: {
    name: string;
    gstin?: string | null;
    country?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    pincode?: string | null;
    phoneCountryCode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logo?: string | null;
    logoUrl?: string | null;
    signature?: string | null;
    signatureUrl?: string | null;
    quotationTerms?: string | null;
    bankDetails?: string | null;
  };
  contact: {
    firstName: string;
    lastName?: string | null;
    contactType?: string | null;
    companyName?: string | null;
    contactPersonName?: string | null;
    phoneCountryCode?: string | null;
    phoneNumber: string;
    email?: string | null;
    country?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    pincode?: string | null;
    gstin?: string | null;
    taxId?: string | null;
  };
  deal?: { title: string } | null;
  quotation?: { quoteNumber: string } | null;
  items: Array<{ description: string; quantity: number; unitPrice: unknown; total: unknown }>;
};

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value: unknown) {
  return moneyFormatter.format(Number(value || 0));
}

function dateText(value?: Date | string | null) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function compact(lines: Array<string | null | undefined | false>) {
  return lines.map((line) => (typeof line === 'string' ? line.trim() : '')).filter(Boolean);
}

function addressLines(entity: {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  pincode?: string | null;
  country?: string | null;
}) {
  return compact([
    entity.addressLine1,
    entity.addressLine2,
    [entity.city, entity.state, entity.postalCode || entity.pincode].filter(Boolean).join(', '),
    entity.country || 'India',
  ]);
}

function personName(contact: InvoicePdfData['contact']) {
  if (contact.contactType === 'COMPANY') {
    return contact.companyName || contact.contactPersonName || `${contact.firstName} ${contact.lastName || ''}`.trim();
  }
  return `${contact.firstName} ${contact.lastName || ''}`.trim();
}

function linesHtml(lines: string[]) {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

function multilineHtml(value: string) {
  return escapeHtml(value)
    .split('\n')
    .map((line) => `<p>${line || '&nbsp;'}</p>`)
    .join('');
}

function mimeFromPath(assetPath: string) {
  const clean = assetPath.toLowerCase().split('?')[0];
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

async function assetToSrc(assetPath?: string | null) {
  if (!assetPath) return null;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
  if (!assetPath.startsWith('/uploads/')) return null;

  try {
    const bytes = await readFile(path.join(process.cwd(), assetPath.replace(/^\/+/, '')));
    return `data:${mimeFromPath(assetPath)};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

function detail(label: string, value: string) {
  return `<div class="detail"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function totals(invoice: InvoicePdfData) {
  const rows = [`<div class="total-row"><span>Subtotal</span><strong>${money(invoice.subtotal)}</strong></div>`];
  if (Number(invoice.cgstAmount || 0) || Number(invoice.sgstAmount || 0)) {
    rows.push(
      `<div class="total-row"><span>CGST</span><strong>${money(invoice.cgstAmount)}</strong></div>`,
      `<div class="total-row"><span>SGST</span><strong>${money(invoice.sgstAmount)}</strong></div>`,
    );
  } else if (Number(invoice.igstAmount || 0)) {
    rows.push(`<div class="total-row"><span>IGST</span><strong>${money(invoice.igstAmount)}</strong></div>`);
  } else if (Number(invoice.taxVatAmount || 0)) {
    rows.push(`<div class="total-row"><span>Tax/VAT</span><strong>${money(invoice.taxVatAmount)}</strong></div>`);
  }
  rows.push(
    `<div class="total-row"><span>Grand Total</span><strong>${money(invoice.total)}</strong></div>`,
    `<div class="total-row"><span>Amount Paid</span><strong>${money(invoice.amountPaid)}</strong></div>`,
    `<div class="total-row balance"><span>Balance Due</span><strong>${money(invoice.balanceDue)}</strong></div>`,
  );
  return rows.join('');
}

async function buildInvoiceHtml(invoice: InvoicePdfData) {
  const title = `${invoice.invoiceNumber} - Invoice`;
  const logoSrc = await assetToSrc(invoice.company.logo || invoice.company.logoUrl);
  const signatureSrc = await assetToSrc(invoice.company.signature || invoice.company.signatureUrl);
  const companyLines = compact([
    invoice.company.name,
    invoice.company.gstin ? `GSTIN: ${invoice.company.gstin}` : null,
    ...addressLines(invoice.company),
    invoice.company.phone ? `Phone: ${[invoice.company.phoneCountryCode || '+91', invoice.company.phone].join(' ')}` : null,
    invoice.company.email ? `Email: ${invoice.company.email}` : null,
    invoice.company.website ? `Website: ${invoice.company.website}` : null,
  ]);
  const customerLines = compact([
    personName(invoice.contact),
    invoice.contact.contactType === 'COMPANY' && invoice.contact.contactPersonName
      ? `Contact: ${invoice.contact.contactPersonName}`
      : null,
    invoice.contact.gstin ? `GSTIN: ${invoice.contact.gstin}` : invoice.contact.taxId ? `Tax/VAT ID: ${invoice.contact.taxId}` : null,
    ...addressLines(invoice.contact),
    `Phone: ${[invoice.contact.phoneCountryCode || '+91', invoice.contact.phoneNumber].join(' ')}`,
    invoice.contact.email ? `Email: ${invoice.contact.email}` : null,
  ]);
  const terms = invoice.terms || invoice.company.quotationTerms || 'Payment terms and delivery scope as discussed.';
  const payment = invoice.company.bankDetails || 'Payment details will be shared separately.';

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #F0EDE4; color: #10201D; font-family: Arial, Helvetica, sans-serif; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 794px; min-height: 1123px; padding: 32px 32px 70px; margin: 0 auto; position: relative; background: #FFFFFF; }
    .header { display: grid; grid-template-columns: 1fr 280px; gap: 18px; margin-bottom: 14px; align-items: start; }
    .brand-logo { max-width: 210px; max-height: 66px; object-fit: contain; object-position: left center; display: block; }
    .brand-fallback { color: #004741; font-size: 26px; font-weight: 800; line-height: 1.05; }
    .doc-box { text-align: right; }
    .doc-title { color: #004741; font-size: 28px; font-weight: 800; letter-spacing: 0.08em; margin: 0 0 8px; }
    .doc-meta { display: grid; gap: 5px; justify-content: end; }
    .doc-meta div { display: grid; grid-template-columns: 74px 1fr; gap: 14px; font-size: 10.5px; color: #6B7A75; min-width: 230px; }
    .doc-meta strong { color: #10201D; text-align: right; }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 12px; }
    .card { background: #FFFFFF; border: 1px solid #DDD8CD; border-radius: 16px; padding: 12px; break-inside: avoid; }
    .soft { background: rgba(240,237,228,.42); }
    .card-title { color: #004741; font-size: 10px; font-weight: 800; letter-spacing: .12em; margin-bottom: 8px; }
    .line-list p { margin: 0 0 4px; color: #6B7A75; font-size: 10.5px; line-height: 1.28; }
    .line-list p:first-child { color: #10201D; font-size: 14px; font-weight: 800; }
    .project { display: grid; grid-template-columns: 1.7fr .8fr .8fr 1fr; gap: 12px; margin-bottom: 12px; }
    .detail span { display: block; color: #6B7A75; font-size: 10px; margin-bottom: 4px; }
    .detail strong { display: block; color: #10201D; font-size: 11.5px; line-height: 1.25; }
    table { width: 100%; page-break-inside: auto; border-collapse: separate; border-spacing: 0; overflow: hidden; background: #FFFFFF; border: 1px solid #DDD8CD; border-radius: 16px; margin-bottom: 12px; }
    thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; page-break-after: auto; }
    th { background: #004741; color: #FFFFFF; padding: 9px 10px; font-size: 10px; text-align: left; }
    th:first-child, td:first-child, th:nth-child(3), td:nth-child(3) { text-align: center; }
    th:nth-child(4), th:nth-child(5), .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td { padding: 8px 10px; border-bottom: 1px solid #DDD8CD; font-size: 10.5px; line-height: 1.25; vertical-align: top; }
    tr:nth-child(even) td { background: rgba(240,237,228,.42); }
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .totals { width: 300px; background: #FFFFFF; border: 1px solid #DDD8CD; border-radius: 16px; padding: 10px; break-inside: avoid; }
    .total-row { display: flex; justify-content: space-between; gap: 20px; padding: 6px 0; color: #6B7A75; font-size: 10.5px; border-bottom: 1px solid rgba(221,216,205,.75); }
    .total-row strong { color: #10201D; white-space: nowrap; }
    .balance { margin-top: 8px; padding: 9px 10px; border: 0; border-radius: 12px; background: #004741; color: #FFFFFF; font-weight: 800; }
    .balance strong { color: #FFFFFF; font-size: 13px; }
    .closing-section { break-inside: avoid; page-break-inside: avoid; }
    .bottom-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 14px; margin-bottom: 14px; }
    .body-copy p { margin: 0 0 4px; color: #6B7A75; font-size: 10.5px; line-height: 1.3; }
    .signature { display: flex; justify-content: flex-end; margin: 18px 0; break-inside: avoid; }
    .signature-inner { width: 230px; text-align: center; color: #6B7A75; font-size: 10.5px; }
    .signature-space, .signature-img { height: 55px; margin-bottom: 6px; }
    .signature-img { width: 100%; object-fit: contain; }
    .signature-line { border-top: 1px solid #10201D; padding-top: 7px; }
    .signature strong { display: block; color: #10201D; font-size: 11.5px; margin-bottom: 3px; }
    .footer { position: absolute; left: 32px; right: 32px; bottom: 28px; padding-top: 10px; border-top: 1px solid #DDD8CD; display: flex; justify-content: space-between; align-items: center; color: #6B7A75; font-size: 9px; }
    @media print { .footer { position: fixed; bottom: 28px; } table { page-break-inside: auto; } tr { page-break-inside: avoid; page-break-after: auto; } thead { display: table-header-group; } }
  </style></head><body><main class="sheet">
    <header class="header"><div>${logoSrc ? `<img class="brand-logo" src="${escapeHtml(logoSrc)}" />` : `<div class="brand-fallback">${escapeHtml(invoice.company.name)}</div>`}</div>
      <section class="doc-box"><h1 class="doc-title">INVOICE</h1><div class="doc-meta">
        <div><span>Invoice No</span><strong>${escapeHtml(invoice.invoiceNumber)}</strong></div>
        <div><span>Issue Date</span><strong>${escapeHtml(dateText(invoice.issueDate))}</strong></div>
        <div><span>Due Date</span><strong>${escapeHtml(dateText(invoice.dueDate))}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(invoice.status)}</strong></div>
      </div></section></header>
    <section class="cards"><div class="card soft"><div class="card-title">FROM</div><div class="line-list">${linesHtml(companyLines)}</div></div><div class="card"><div class="card-title">BILL TO</div><div class="line-list">${linesHtml(customerLines)}</div></div></section>
    <section class="card project">${detail('Project Name', invoice.deal?.title || 'General invoice')}${detail('Invoice Status', invoice.status)}${detail('Currency', 'INR')}${detail('Payment Terms', invoice.paymentTerms || 'On approval')}</section>
    <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>
      ${invoice.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.description)}</td><td>${item.quantity}</td><td class="money">${money(item.unitPrice)}</td><td class="money"><strong>${money(item.total)}</strong></td></tr>`).join('')}
    </tbody></table>
    <section class="totals-wrap"><div class="totals">${totals(invoice)}</div></section>
    <section class="closing-section"><section class="bottom-grid"><div class="card soft"><div class="card-title">TERMS</div><div class="body-copy">${multilineHtml(terms)}</div></div><div class="card"><div class="card-title">PAYMENT DETAILS</div><div class="body-copy">${multilineHtml(payment)}</div></div></section>
    <section class="signature"><div class="signature-inner">${signatureSrc ? `<img class="signature-img" src="${escapeHtml(signatureSrc)}" />` : '<div class="signature-space"></div>'}<div class="signature-line"><strong>Authorized Signatory</strong><span>${escapeHtml(invoice.company.name)}</span></div></div></section></section>
    <div class="footer"><div>Thank you for your business.</div><div>Generated using LeadFlow CRM</div></div>
  </main></body></html>`;
}

export async function generateInvoicePdfHtml(invoice: InvoicePdfData) {
  const documentTitle = `${invoice.invoiceNumber} - Invoice`;
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(await buildInvoiceHtml(invoice), { waitUntil: 'load' });
    await page.evaluate((title) => {
      document.title = title;
    }, documentTitle);
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    const doc = await PDFDocument.load(pdf);
    doc.setTitle(documentTitle);
    doc.setAuthor(invoice.company.name);
    doc.setSubject('Invoice');
    doc.setCreator('LeadFlow CRM');
    doc.setProducer('LeadFlow CRM');
    return Buffer.from(await doc.save());
  } finally {
    await browser.close();
  }
}
