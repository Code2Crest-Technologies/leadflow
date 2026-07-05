import { ContactStatus, DealStage, InvoiceStatus, Prisma, QuotationStatus } from '@prisma/client';
import type { AuthPayload } from '../types/index.js';
import { prisma } from '../config/database.js';
import { getDealWhere, getInvoiceWhere, getQuotationWhere } from '../middleware/permissions.js';
import { getAnalyticsData } from './analytics.service.js';

type ExportQuery = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  source?: string;
};

function csvValue(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\r\n');
}

function dateRange(query: ExportQuery) {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
    ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
  };
}

function contactName(contact?: { firstName?: string | null; lastName?: string | null; companyName?: string | null; contactPersonName?: string | null; contactType?: string | null }) {
  if (!contact) return '';
  if (contact.contactType === 'COMPANY') return contact.companyName || contact.contactPersonName || contact.firstName || '';
  return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
}

export async function exportContactsCsv(auth: AuthPayload, query: ExportQuery) {
  const createdAt = dateRange(query);
  const where: Prisma.ContactWhereInput = {
    companyId: auth.companyId,
    ...(query.status ? { status: query.status as ContactStatus } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const contacts = await prisma.contact.findMany({ where, orderBy: { createdAt: 'desc' } });
  return toCsv(
    ['Name', 'Contact Type', 'Company Name', 'Phone Code', 'Phone Number', 'Email', 'Country', 'State', 'City', 'Postal Code', 'GSTIN', 'Tax ID', 'Segment', 'Status', 'Created At'],
    contacts.map((contact) => [
      contactName(contact),
      contact.contactType,
      contact.companyName,
      contact.phoneCountryCode,
      contact.phoneNumber,
      contact.email,
      contact.country,
      contact.state,
      contact.city,
      contact.postalCode || contact.pincode,
      contact.gstin,
      contact.taxId,
      contact.segment,
      contact.status,
      contact.createdAt,
    ]),
  );
}

export async function exportDealsCsv(auth: AuthPayload, query: ExportQuery) {
  const createdAt = dateRange(query);
  const where: Prisma.DealWhereInput = {
    ...getDealWhere(auth),
    ...(query.status ? { stage: query.status as DealStage } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const deals = await prisma.deal.findMany({
    where,
    include: { contact: true, assignedTo: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return toCsv(
    ['Deal Title', 'Contact Name', 'Stage', 'Value', 'Currency', 'Source', 'Probability', 'Assigned To', 'Created At', 'Closed At'],
    deals.map((deal) => [
      deal.title,
      contactName(deal.contact),
      deal.stage,
      deal.value,
      deal.currency,
      deal.source,
      deal.probability,
      `${deal.assignedTo.firstName} ${deal.assignedTo.lastName}`,
      deal.createdAt,
      deal.closedAt,
    ]),
  );
}

export async function exportQuotationsCsv(auth: AuthPayload, query: ExportQuery) {
  const createdAt = dateRange(query);
  const where: Prisma.QuotationWhereInput = {
    ...getQuotationWhere(auth),
    ...(query.status ? { status: query.status as QuotationStatus } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const quotations = await prisma.quotation.findMany({
    where,
    include: { contact: true, deal: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return toCsv(
    ['Quote Number', 'Customer', 'Deal', 'Status', 'Subtotal', 'Tax Percent', 'Total', 'Created At'],
    quotations.map((quotation) => [
      quotation.quoteNumber,
      contactName(quotation.contact),
      quotation.deal?.title,
      quotation.status,
      quotation.subtotal,
      quotation.gstPercent,
      quotation.total,
      quotation.createdAt,
    ]),
  );
}

export async function exportInvoicesCsv(auth: AuthPayload, query: ExportQuery) {
  const createdAt = dateRange(query);
  const where: Prisma.InvoiceWhereInput = {
    ...getInvoiceWhere(auth),
    ...(query.status ? { status: query.status as InvoiceStatus } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const invoices = await prisma.invoice.findMany({
    where,
    include: { contact: true, deal: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return toCsv(
    ['Invoice Number', 'Customer', 'Deal', 'Status', 'Subtotal', 'Tax Percent', 'Total', 'Amount Paid', 'Balance Due', 'Issue Date', 'Due Date', 'Created At'],
    invoices.map((invoice) => [
      invoice.invoiceNumber,
      contactName(invoice.contact),
      invoice.deal?.title,
      invoice.status,
      invoice.subtotal,
      invoice.taxPercent,
      invoice.total,
      invoice.amountPaid,
      invoice.balanceDue,
      invoice.issueDate,
      invoice.dueDate,
      invoice.createdAt,
    ]),
  );
}

export async function exportAnalyticsSummaryCsv(auth: AuthPayload) {
  const analytics = await getAnalyticsData(auth);
  const summary = analytics.summary;
  return toCsv(
    ['Metric', 'Value'],
    [
      ['Total Leads', summary.totalLeads],
      ['Total Deals', summary.totalDeals],
      ['Open Deals', summary.openDeals],
      ['Won Deals', summary.wonDeals],
      ['Lost Deals', summary.lostDeals],
      ['Pipeline Value', summary.pipelineValue],
      ['Won Revenue', summary.wonRevenue],
      ['Invoices', summary.invoiceCount],
      ['Paid Revenue', summary.paidRevenue],
      ['Outstanding', summary.outstandingAmount],
      ['Overdue Amount', summary.overdueAmount],
      ['Conversion Rate', `${summary.conversionRate}%`],
    ],
  );
}

export async function exportAnalyticsSourcesCsv(auth: AuthPayload) {
  const analytics = await getAnalyticsData(auth);
  return toCsv(
    ['Source', 'Leads', 'Open Deals', 'Won Deals', 'Lost Deals', 'Revenue', 'Conversion Rate'],
    analytics.sources.map((source) => [
      source.source,
      source.leads,
      source.openDeals,
      source.wonDeals,
      source.lostDeals,
      source.revenue,
      `${source.conversionRate}%`,
    ]),
  );
}

export async function exportAnalyticsMonthlySalesCsv(auth: AuthPayload) {
  const analytics = await getAnalyticsData(auth);
  const salesByMonth = new Map(analytics.monthlySales.map((month) => [month.month, month]));
  const invoiceByMonth = new Map(analytics.monthlyInvoices.map((month) => [month.month, month]));
  const months = Array.from(new Set([...salesByMonth.keys(), ...invoiceByMonth.keys()]));
  return toCsv(
    ['Month', 'Won Revenue', 'Won Deals', 'Invoiced Amount', 'Paid Amount'],
    months.map((monthName) => {
      const sale = salesByMonth.get(monthName);
      const invoice = invoiceByMonth.get(monthName);
      return [monthName, sale?.revenue || 0, sale?.wonDeals || 0, invoice?.invoiced || 0, invoice?.paid || 0];
    }),
  );
}

export async function exportAnalyticsInvoicesCsv(auth: AuthPayload) {
  const analytics = await getAnalyticsData(auth);
  return toCsv(
    ['Month', 'Invoice Count', 'Invoiced Amount', 'Paid Amount', 'Outstanding Amount', 'Overdue Amount'],
    analytics.monthlyInvoices.map((month) => [
      month.month,
      month.invoiceCount,
      month.invoiced,
      month.paid,
      month.outstanding,
      month.overdue,
    ]),
  );
}

export function exportFileName(entity: string) {
  return `leadflow-${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
}
