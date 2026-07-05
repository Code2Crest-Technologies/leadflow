import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import { calculateTaxBreakdown, isIndia } from '../utils/tax';

type PdfCompany = {
  name: string;
  gstin?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  postalCode?: string | null;
  phoneCountryCode?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  signature?: string | null;
  signatureUrl?: string | null;
  quotationTerms?: string | null;
  bankDetails?: string | null;
};

type PdfContact = {
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
  pincode?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  taxId?: string | null;
};

type PdfDeal = {
  title: string;
} | null;

type PdfItem = {
  description: string;
  quantity: number;
  unitPrice: unknown;
  total: unknown;
};

export type QuotationPdfHtmlData = {
  quoteNumber: string;
  status: string;
  gstPercent: unknown;
  paymentTerms?: string | null;
  terms?: string | null;
  subtotal: unknown;
  total: unknown;
  createdAt: Date | string;
  company: PdfCompany;
  contact: PdfContact;
  deal: PdfDeal;
  items: PdfItem[];
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function asNumber(value: unknown) {
  return Number(value || 0);
}

function money(value: unknown) {
  return currencyFormatter.format(asNumber(value));
}

function percent(value: unknown) {
  const amount = asNumber(value);
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactLines(lines: Array<string | null | undefined | false>) {
  return lines.map((line) => (typeof line === 'string' ? line.trim() : '')).filter(Boolean);
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

function contactDisplayName(contact: PdfContact) {
  if (contact.contactType === 'COMPANY') {
    return contact.companyName || contact.contactPersonName || `${contact.firstName} ${contact.lastName || ''}`.trim();
  }
  return `${contact.firstName} ${contact.lastName || ''}`.trim();
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
  return compactLines([
    entity.addressLine1,
    entity.addressLine2,
    [entity.city, entity.state, entity.postalCode || entity.pincode].filter(Boolean).join(', '),
    entity.country || 'India',
  ]);
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

  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  if (!assetPath.startsWith('/uploads/')) {
    return null;
  }

  try {
    const relativePath = assetPath.replace(/^\/+/, '');
    const diskPath = path.join(process.cwd(), relativePath);
    const bytes = await readFile(diskPath);
    return `data:${mimeFromPath(assetPath)};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

function buildDetail(label: string, value: string) {
  return `
    <div class="detail">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function buildTotalsRows(quotation: QuotationPdfHtmlData) {
  const tax = calculateTaxBreakdown({
    subtotal: quotation.subtotal,
    taxPercent: quotation.gstPercent,
    companyCountry: quotation.company.country,
    companyState: quotation.company.state,
    customerCountry: quotation.contact.country,
    customerState: quotation.contact.state,
  });

  const rows = [`<div class="total-row"><span>Subtotal</span><strong>${money(quotation.subtotal)}</strong></div>`];

  if (tax.label === 'CGST_SGST') {
    rows.push(
      `<div class="total-row"><span>CGST (${percent(asNumber(quotation.gstPercent) / 2)}%)</span><strong>${money(tax.cgstAmount)}</strong></div>`,
      `<div class="total-row"><span>SGST (${percent(asNumber(quotation.gstPercent) / 2)}%)</span><strong>${money(tax.sgstAmount)}</strong></div>`,
    );
  } else if (tax.label === 'IGST') {
    rows.push(
      `<div class="total-row"><span>IGST (${percent(quotation.gstPercent)}%)</span><strong>${money(tax.igstAmount)}</strong></div>`,
    );
  } else if (tax.label === 'TAX_VAT') {
    rows.push(
      `<div class="total-row"><span>Tax/VAT (${percent(quotation.gstPercent)}%)</span><strong>${money(tax.taxVatAmount)}</strong></div>`,
    );
  }

  rows.push(`<div class="total-row grand"><span>Grand Total</span><strong>${money(quotation.total)}</strong></div>`);
  return rows.join('');
}

async function buildQuotationHtml(quotation: QuotationPdfHtmlData) {
  const logoSrc = await assetToSrc(quotation.company.logo || quotation.company.logoUrl);
  const signatureSrc = await assetToSrc(quotation.company.signature || quotation.company.signatureUrl);
  const documentTitle = `${quotation.quoteNumber} - Quotation`;
  const quoteDate = new Date(quotation.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const companyLines = compactLines([
    quotation.company.name,
    isIndia(quotation.company.country) && quotation.company.gstin ? `GSTIN: ${quotation.company.gstin}` : null,
    ...addressLines(quotation.company),
    quotation.company.phone
      ? `Phone: ${[quotation.company.phoneCountryCode || '+91', quotation.company.phone].filter(Boolean).join(' ')}`
      : null,
    quotation.company.email ? `Email: ${quotation.company.email}` : null,
    quotation.company.website ? `Website: ${quotation.company.website}` : null,
  ]);

  const customerLines = compactLines([
    contactDisplayName(quotation.contact),
    quotation.contact.contactType === 'COMPANY' && quotation.contact.companyName
      ? `Company: ${quotation.contact.companyName}`
      : null,
    quotation.contact.contactType === 'COMPANY' && quotation.contact.contactPersonName
      ? `Contact: ${quotation.contact.contactPersonName}`
      : null,
    isIndia(quotation.contact.country) && quotation.contact.gstin ? `GSTIN: ${quotation.contact.gstin}` : null,
    !isIndia(quotation.contact.country) && quotation.contact.taxId ? `Tax/VAT ID: ${quotation.contact.taxId}` : null,
    ...addressLines(quotation.contact),
    `Phone: ${[quotation.contact.phoneCountryCode || '+91', quotation.contact.phoneNumber].filter(Boolean).join(' ')}`,
    quotation.contact.email ? `Email: ${quotation.contact.email}` : null,
  ]);

  const terms =
    quotation.terms ||
    quotation.company.quotationTerms ||
    'Payment terms and delivery scope as discussed.';
  const paymentDetails = quotation.company.bankDetails || 'Payment details will be shared separately.';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #F0EDE4;
      color: #10201D;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 794px;
      min-height: 1123px;
      padding: 32px 32px 70px;
      margin: 0 auto;
      position: relative;
      background: #FFFFFF;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr 280px;
      align-items: start;
      gap: 18px;
      margin-bottom: 14px;
      padding-bottom: 0;
    }
    .brand-logo {
      max-width: 210px;
      max-height: 66px;
      object-fit: contain;
      object-position: left center;
      display: block;
    }
    .brand-fallback {
      color: #004741;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }
    .quote-box {
      text-align: right;
    }
    .quote-title {
      color: #004741;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin: 0 0 8px;
    }
    .quote-meta {
      display: grid;
      gap: 5px;
      justify-content: end;
    }
    .quote-meta div {
      display: grid;
      grid-template-columns: 74px 1fr;
      gap: 14px;
      font-size: 10.5px;
      color: #6B7A75;
      min-width: 230px;
    }
    .quote-meta strong {
      color: #10201D;
      text-align: right;
    }
    .cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 12px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #DDD8CD;
      border-radius: 16px;
      padding: 12px;
      break-inside: avoid;
    }
    .card.soft { background: rgba(255, 255, 255, 0.72); }
    .card-title {
      color: #004741;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      margin-bottom: 8px;
    }
    .line-list p {
      margin: 0 0 4px;
      color: #6B7A75;
      font-size: 10.5px;
      line-height: 1.28;
    }
    .line-list p:first-child {
      color: #10201D;
      font-size: 14px;
      font-weight: 800;
    }
    .project {
      display: grid;
      grid-template-columns: 1.7fr 0.7fr 0.7fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }
    .detail span {
      display: block;
      color: #6B7A75;
      font-size: 10px;
      margin-bottom: 4px;
    }
    .detail strong {
      display: block;
      color: #10201D;
      font-size: 11.5px;
      line-height: 1.25;
    }
    table {
      width: 100%;
      page-break-inside: auto;
      border-collapse: separate;
      border-spacing: 0;
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid #DDD8CD;
      border-radius: 16px;
      margin-bottom: 12px;
    }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { break-inside: avoid; page-break-inside: avoid; page-break-after: auto; }
    thead th {
      background: #004741;
      color: #FFFFFF;
      padding: 9px 10px;
      font-size: 10px;
      text-align: left;
    }
    thead th:first-child { width: 46px; text-align: center; }
    thead th:nth-child(3) { width: 76px; text-align: center; }
    thead th:nth-child(4),
    thead th:nth-child(5) { width: 132px; text-align: right; }
    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid #DDD8CD;
      color: #10201D;
      font-size: 10.5px;
      line-height: 1.25;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: rgba(240, 237, 228, 0.42); }
    tbody tr:last-child td { border-bottom: 0; }
    tbody td:first-child,
    tbody td:nth-child(3) {
      text-align: center;
      color: #6B7A75;
      font-weight: 700;
    }
    .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .description { overflow-wrap: anywhere; }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }
    .totals {
      width: 280px;
      background: #FFFFFF;
      border: 1px solid #DDD8CD;
      border-radius: 16px;
      padding: 10px;
      break-inside: avoid;
    }
    .total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 6px 0;
      color: #6B7A75;
      font-size: 10.5px;
      border-bottom: 1px solid rgba(221, 216, 205, 0.75);
    }
    .total-row strong {
      color: #10201D;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .total-row.grand {
      margin-top: 8px;
      padding: 9px 10px;
      border: 0;
      border-radius: 12px;
      background: #004741;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
    }
    .total-row.grand strong { color: #FFFFFF; font-size: 13px; }
    .closing-section {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .bottom-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .body-copy p {
      margin: 0 0 4px;
      color: #6B7A75;
      font-size: 10.5px;
      line-height: 1.3;
    }
    .payment p { color: #10201D; }
    .signature {
      display: flex;
      justify-content: flex-end;
      margin: 18px 0 18px;
      break-inside: avoid;
    }
    .signature-inner {
      width: 230px;
      text-align: center;
      color: #6B7A75;
      font-size: 10.5px;
    }
    .signature-space {
      height: 55px;
      margin-bottom: 6px;
    }
    .signature-img {
      width: 100%;
      height: 55px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .signature-line {
      border-top: 1px solid #10201D;
      padding-top: 7px;
      margin-top: 0;
    }
    .signature strong {
      display: block;
      color: #10201D;
      font-size: 11.5px;
      margin-bottom: 3px;
    }
    .footer {
      position: absolute;
      left: 32px;
      right: 32px;
      bottom: 28px;
      padding-top: 10px;
      border-top: 1px solid #DDD8CD;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #6B7A75;
      font-size: 9px;
      line-height: 1.2;
    }
    .footer-left {
      text-align: left;
    }
    .footer-right {
      text-align: right;
    }
    @media print {
      .footer {
        position: fixed;
        bottom: 28px;
      }
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div>
        ${
          logoSrc
            ? `<img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(quotation.company.name)} logo" />`
            : `<div class="brand-fallback">${escapeHtml(quotation.company.name)}</div>`
        }
      </div>
      <section class="quote-box">
        <h1 class="quote-title">QUOTATION</h1>
        <div class="quote-meta">
          <div><span>Quote No</span><strong>${escapeHtml(quotation.quoteNumber)}</strong></div>
          <div><span>Date</span><strong>${escapeHtml(quoteDate)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(quotation.status)}</strong></div>
        </div>
      </section>
    </header>

    <section class="cards">
      <div class="card soft">
        <div class="card-title">FROM</div>
        <div class="line-list">${linesHtml(companyLines)}</div>
      </div>
      <div class="card">
        <div class="card-title">BILL TO</div>
        <div class="line-list">${linesHtml(customerLines)}</div>
      </div>
    </section>

    <section class="card project">
      ${buildDetail('Project Name', quotation.deal?.title || 'General quotation')}
      ${buildDetail('Status', quotation.status)}
      ${buildDetail('Currency', 'INR')}
      ${buildDetail('Payment Terms', quotation.paymentTerms || 'On approval')}
    </section>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${quotation.items
          .map(
            (item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="description">${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.quantity)}</td>
                <td class="money">${money(item.unitPrice)}</td>
                <td class="money"><strong>${money(item.total)}</strong></td>
              </tr>
            `,
          )
          .join('')}
      </tbody>
    </table>

    <section class="totals-wrap">
      <div class="totals">${buildTotalsRows(quotation)}</div>
    </section>

    <section class="closing-section">
      <section class="bottom-grid">
        <div class="card soft">
          <div class="card-title">TERMS & CONDITIONS</div>
          <div class="body-copy">${multilineHtml(terms)}</div>
        </div>
        <div class="card">
          <div class="card-title">PAYMENT DETAILS</div>
          <div class="body-copy payment">${multilineHtml(paymentDetails)}</div>
        </div>
      </section>

      <section class="signature">
        <div class="signature-inner">
          ${
            signatureSrc
              ? `<img class="signature-img" src="${escapeHtml(signatureSrc)}" alt="Authorized signature" />`
              : '<div class="signature-space"></div>'
          }
          <div class="signature-line">
            <strong>Authorized Signatory</strong>
            <span>${escapeHtml(quotation.company.name)}</span>
          </div>
        </div>
      </section>
    </section>
    <div class="footer">
      <div class="footer-left">Thank you for your business.</div>
      <div class="footer-right">Generated using LeadFlow CRM</div>
    </div>
  </main>
</body>
</html>`;
}

export async function generateQuotationPdfHtml(quotation: QuotationPdfHtmlData) {
  const documentTitle = `${quotation.quoteNumber} - Quotation`;
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(await buildQuotationHtml(quotation), {
      waitUntil: 'load',
    });
    await page.evaluate((title) => {
      document.title = title;
    }, documentTitle);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    const pdfDocument = await PDFDocument.load(pdf);
    pdfDocument.setTitle(documentTitle);
    pdfDocument.setAuthor(quotation.company.name);
    pdfDocument.setSubject('Quotation');
    pdfDocument.setCreator('LeadFlow CRM');
    pdfDocument.setProducer('LeadFlow CRM');

    return Buffer.from(await pdfDocument.save());
  } finally {
    await browser.close();
  }
}
