"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LeadService } from "@/services";
import type { Invoice } from "@/types";
import { DownloadIcon } from "@/components/ui/Icons";

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function contactName(invoice: Invoice) {
  const contact = invoice.contact;
  if (!contact) return "Customer";
  if (contact.contactType === "COMPANY") return contact.companyName || contact.contactPersonName || contact.firstName;
  return `${contact.firstName} ${contact.lastName || ""}`.trim();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PublicInvoicePage() {
  const params = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function load() {
      setError("");
      setLoading(true);
      try {
        setInvoice(await LeadService.getPublicInvoice(params.token));
      } catch {
        setError("This invoice link is invalid or expired.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.token]);

  async function downloadPdf() {
    if (!invoice) return;
    setDownloading(true);
    try {
      downloadBlob(await LeadService.downloadPublicInvoicePdf(params.token), `${invoice.invoiceNumber}.pdf`);
    } catch {
      setError("Could not download invoice PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[var(--color-bg)] p-6 text-sm text-slate-500">Loading invoice...</main>;
  }

  if (!invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6">
        <div className="max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">Invoice unavailable</h1>
          <p className="mt-2 text-slate-500">{error || "This invoice link is invalid or expired."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-8">
      <section className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Invoice</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{invoice.invoiceNumber}</h1>
            <p className="mt-1 text-slate-500">{contactName(invoice)}</p>
          </div>
          <button type="button" onClick={downloadPdf} className="btn-primary" disabled={downloading}>
            <DownloadIcon className="h-4 w-4" />
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
        </header>

        {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl bg-[var(--color-bg)] p-4">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(invoice.total)}</p>
          </article>
          <article className="rounded-xl bg-[var(--color-bg)] p-4">
            <p className="text-sm text-slate-500">Paid</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(invoice.amountPaid)}</p>
          </article>
          <article className="rounded-xl bg-[var(--color-bg)] p-4">
            <p className="text-sm text-slate-500">Balance Due</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(invoice.balanceDue)}</p>
          </article>
        </section>

        <section className="mt-6 overflow-x-auto rounded-2xl border border-[var(--color-border)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[#004741] text-white">
              <tr>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {invoice.items.map((item) => (
                <tr key={item.id || item.description}>
                  <td className="px-4 py-3 font-semibold">{item.description}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-slate-500">
          <span>Status: {invoice.status.replace("_", " ")}</span>
          <span>Generated using LeadFlow CRM</span>
        </footer>
      </section>
    </main>
  );
}
