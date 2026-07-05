import type { AuthPayload } from '../types/index.js';
import { prisma } from '../config/database.js';
import { isOpenDealStage } from '../constants/dealStages.js';
import { getDealWhere, getInvoiceWhere } from '../middleware/permissions.js';

function getJsonSource(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return typeof record.source === 'string' && record.source.trim()
    ? record.source.trim()
    : null;
}

function normalizeSource(source?: string | null) {
  return source?.trim().toLowerCase() || 'manual';
}

function monthLabel(date: Date) {
  return date.toLocaleString('en-US', { month: 'short' });
}

export async function getAnalyticsData(auth: AuthPayload) {
  const dealWhere = getDealWhere(auth);
  const invoiceWhere = getInvoiceWhere(auth);
  const [contacts, deals, invoices] = await Promise.all([
    prisma.contact.findMany({
      where: { companyId: auth.companyId },
      select: {
        id: true,
        metaLeadData: true,
        customFields: true,
      },
    }),
    prisma.deal.findMany({
      where: dealWhere,
      select: {
        id: true,
        source: true,
        stage: true,
        value: true,
        updatedAt: true,
        closedAt: true,
        contact: {
          select: {
            metaLeadData: true,
            customFields: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        status: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        issueDate: true,
        dueDate: true,
      },
    }),
  ]);

  const sourceMap = new Map<
    string,
    {
      source: string;
      leads: number;
      wonDeals: number;
      lostDeals: number;
      openDeals: number;
      revenue: number;
      totalDeals: number;
    }
  >();

  const ensureSource = (source: string) => {
    const key = normalizeSource(source);
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        source: key,
        leads: 0,
        wonDeals: 0,
        lostDeals: 0,
        openDeals: 0,
        revenue: 0,
        totalDeals: 0,
      });
    }
    return sourceMap.get(key)!;
  };

  contacts.forEach((contact) => {
    const source =
      getJsonSource(contact.customFields) ||
      getJsonSource(contact.metaLeadData) ||
      'manual';
    ensureSource(source).leads += 1;
  });

  const monthlyMap = new Map<string, { month: string; revenue: number; wonDeals: number }>();
  const monthlyInvoiceMap = new Map<
    string,
    {
      month: string;
      invoiceCount: number;
      invoiced: number;
      paid: number;
      outstanding: number;
      overdue: number;
    }
  >();

  deals.forEach((deal) => {
    const source =
      deal.source ||
      getJsonSource(deal.contact?.customFields) ||
      getJsonSource(deal.contact?.metaLeadData) ||
      'manual';
    const bucket = ensureSource(source);
    const value = Number(deal.value || 0);

    bucket.totalDeals += 1;
    if (deal.stage === 'WON') {
      bucket.wonDeals += 1;
      bucket.revenue += value;

      const date = deal.closedAt || deal.updatedAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const month = monthlyMap.get(key) || { month: monthLabel(date), revenue: 0, wonDeals: 0 };
      month.revenue += value;
      month.wonDeals += 1;
      monthlyMap.set(key, month);
    } else if (deal.stage === 'LOST') {
      bucket.lostDeals += 1;
    } else if (isOpenDealStage(deal.stage)) {
      bucket.openDeals += 1;
    }
  });

  const totalLeads = contacts.length;
  const totalDeals = deals.length;
  const wonDeals = deals.filter((deal) => deal.stage === 'WON').length;
  const lostDeals = deals.filter((deal) => deal.stage === 'LOST').length;
  const openDeals = deals.filter((deal) => isOpenDealStage(deal.stage)).length;
  const pipelineValue = deals
    .filter((deal) => isOpenDealStage(deal.stage))
    .reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const wonRevenue = deals
    .filter((deal) => deal.stage === 'WON')
    .reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const activeInvoices = invoices.filter((invoice) => invoice.status !== 'CANCELLED');
  const now = new Date();
  const paidInvoiceCount = activeInvoices.filter((invoice) => invoice.status === 'PAID').length;
  const overdueInvoices = activeInvoices.filter(
    (invoice) =>
      invoice.status === 'OVERDUE' ||
      (invoice.dueDate && invoice.dueDate < now && Number(invoice.balanceDue || 0) > 0),
  );

  activeInvoices.forEach((invoice) => {
    const date = invoice.issueDate;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const balanceDue = Number(invoice.balanceDue || 0);
    const isOverdue =
      invoice.status === 'OVERDUE' || Boolean(invoice.dueDate && invoice.dueDate < now && balanceDue > 0);
    const month = monthlyInvoiceMap.get(key) || {
      month: monthLabel(date),
      invoiceCount: 0,
      invoiced: 0,
      paid: 0,
      outstanding: 0,
      overdue: 0,
    };
    month.invoiceCount += 1;
    month.invoiced += Number(invoice.total || 0);
    month.paid += Number(invoice.amountPaid || 0);
    month.outstanding += balanceDue;
    if (isOverdue) month.overdue += balanceDue;
    monthlyInvoiceMap.set(key, month);
  });

  return {
    summary: {
      totalLeads,
      totalDeals,
      openDeals,
      wonDeals,
      lostDeals,
      pipelineValue,
      wonRevenue,
      conversionRate: totalDeals ? Math.round((wonDeals / totalDeals) * 100) : 0,
      invoiceCount: activeInvoices.length,
      paidInvoiceCount,
      overdueInvoiceCount: overdueInvoices.length,
      totalInvoiceAmount: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
      paidRevenue: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0),
      outstandingAmount: activeInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0),
      overdueAmount: overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0),
    },
    sources: Array.from(sourceMap.values())
      .map((source) => ({
        ...source,
        conversionRate: source.totalDeals
          ? Math.round((source.wonDeals / source.totalDeals) * 100)
          : 0,
      }))
      .sort((a, b) => b.leads - a.leads || b.revenue - a.revenue),
    monthlySales: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, value]) => value),
    monthlyInvoices: Array.from(monthlyInvoiceMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([, value]) => value),
  };
}
