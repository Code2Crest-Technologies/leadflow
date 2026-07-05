"use client";

import { useCallback, useEffect, useState } from "react";
import { LeadService } from "@/services";
import { AuthService } from "@/services/authService";
import type { User } from "@/types";
import { DownloadIcon } from "@/components/ui/Icons";

type AnalyticsSource = {
  source: string;
  leads: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  revenue: number;
  conversionRate: number;
};

type AnalyticsSummary = {
  totalLeads: number;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  wonRevenue: number;
  conversionRate: number;
  invoiceCount?: number;
  paidInvoiceCount?: number;
  overdueInvoiceCount?: number;
  totalInvoiceAmount?: number;
  paidRevenue?: number;
  outstandingAmount?: number;
  overdueAmount?: number;
};

type AnalyticsData = {
  sources: AnalyticsSource[];
  summary: AnalyticsSummary;
  monthlySales: Array<{
    month: string;
    revenue: number;
    wonDeals: number;
  }>;
  monthlyInvoices?: Array<{
    month: string;
    invoiceCount?: number;
    invoiced: number;
    paid: number;
    outstanding?: number;
    overdue?: number;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatSource(source: string) {
  return source
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setData((await LeadService.getAnalytics()) as AnalyticsData);
    } catch {
      setError("Could not load analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrentUser(AuthService.getUser());
    void load();
  }, [load]);

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv(entity: 'analytics-summary' | 'analytics-sources' | 'analytics-monthly-sales' | 'analytics-invoices') {
    setError("");
    setExporting(entity);
    try {
      downloadBlob(await LeadService.downloadExport(entity), `leadflow-${entity}.csv`);
      setExportOpen(false);
    } catch {
      setError("Could not export analytics. Admin or manager access is required.");
    } finally {
      setExporting("");
    }
  }

  const summary = data?.summary;
  const cards = [
    ["Total Leads", summary?.totalLeads ?? 0],
    ["Total Deals", summary?.totalDeals ?? 0],
    ["Open Deals", summary?.openDeals ?? 0],
    ["Won Deals", summary?.wonDeals ?? 0],
    ["Lost Deals", summary?.lostDeals ?? 0],
    ["Pipeline Value", formatCurrency(summary?.pipelineValue ?? 0)],
    ["Won Revenue", formatCurrency(summary?.wonRevenue ?? 0)],
    ["Conversion Rate", `${summary?.conversionRate ?? 0}%`],
    ["Invoices", summary?.invoiceCount ?? 0],
    ["Paid Revenue", formatCurrency(summary?.paidRevenue ?? 0)],
    ["Outstanding", formatCurrency(summary?.outstandingAmount ?? 0)],
    ["Overdue Amount", formatCurrency(summary?.overdueAmount ?? 0)],
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Reporting
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Analytics</h1>
          <p className="mt-1 text-slate-500">
            Lead sources, deal outcomes, and revenue from existing CRM data. Conversion is won deals divided by total deals.
          </p>
        </div>
        {currentUser && ["ADMIN", "MANAGER"].includes(currentUser.role) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              className="btn-primary"
              disabled={Boolean(exporting)}
            >
              <DownloadIcon className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-lg">
                {[
                  ["analytics-summary", "Summary"],
                  ["analytics-sources", "Lead Sources"],
                  ["analytics-monthly-sales", "Monthly Sales"],
                  ["analytics-invoices", "Invoice Performance"],
                ].map(([entity, label]) => (
                  <button
                    key={entity}
                    type="button"
                    onClick={() => exportCsv(entity as 'analytics-summary' | 'analytics-sources' | 'analytics-monthly-sales' | 'analytics-invoices')}
                    className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={Boolean(exporting)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="text-sm font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="card border border-slate-100 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {loading ? "..." : value}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Invoice Performance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invoiced amount and payments received, grouped by invoice issue month.
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading invoice analytics...</p>
        ) : data?.monthlyInvoices?.length ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {data.monthlyInvoices.map((month) => (
              <article key={month.month} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">{month.month}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {formatCurrency(month.invoiced)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Paid: {formatCurrency(month.paid)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-slate-500">
            No invoices yet. Create or convert an accepted quotation to start billing analytics.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Lead Sources</h2>
          <p className="mt-1 text-sm text-slate-500">
            Conversion is calculated as won deals divided by leads for each source.
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading source analytics...</p>
        ) : data?.sources.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Leads</th>
                  <th className="px-5 py-3">Open Deals</th>
                  <th className="px-5 py-3">Won Deals</th>
                  <th className="px-5 py-3">Lost Deals</th>
                  <th className="px-5 py-3">Revenue</th>
                  <th className="px-5 py-3">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sources.map((source) => (
                  <tr key={source.source}>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatSource(source.source)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{source.leads}</td>
                    <td className="px-5 py-4 text-slate-600">{source.openDeals}</td>
                    <td className="px-5 py-4 text-emerald-700">{source.wonDeals}</td>
                    <td className="px-5 py-4 text-red-600">{source.lostDeals}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatCurrency(source.revenue)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(source.conversionRate, 100)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-700">{source.conversionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-8 text-center text-slate-500">
            No analytics yet. Add contacts and deals to see source performance.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">Monthly Sales</h2>
          <p className="mt-1 text-sm text-slate-500">
            Won revenue grouped by the month the deal was closed or last updated.
          </p>
        </div>

        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading monthly sales...</p>
        ) : data?.monthlySales.length ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {data.monthlySales.map((month) => (
              <article key={month.month} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">{month.month}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {formatCurrency(month.revenue)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {month.wonDeals} won {month.wonDeals === 1 ? "deal" : "deals"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-slate-500">
            No won deals yet. Move deals to WON to see monthly revenue.
          </p>
        )}
      </section>
    </main>
  );
}
