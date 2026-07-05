"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import RecordPaymentModal from "@/components/invoices/RecordPaymentModal";
import { LeadService } from "@/services";
import type { Invoice } from "@/types";
import { openWhatsApp } from "@/utils";
import { ArrowLeftIcon, CheckCircleIcon, CreditCardIcon, DownloadIcon, MessageCircleIcon } from "@/components/ui/Icons";

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function contactName(contact?: Invoice["contact"]) {
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

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const data = (await LeadService.getInvoice(params.id)) as Invoice;
      setInvoice(data);
    } catch {
      setError("Could not load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  async function savePayment(payload: { amountReceived: number; paymentDate: string; notes?: string }) {
    if (!invoice) return;
    setMutating(true);
    try {
      await LeadService.updateInvoicePayment(invoice.id, payload);
      setIsPaymentOpen(false);
      await load();
    } catch {
      setError("Could not update payment.");
    } finally {
      setMutating(false);
    }
  }

  async function downloadPdf() {
    if (!invoice) return;
    setMutating(true);
    try {
      downloadBlob(await LeadService.downloadInvoicePdf(invoice.id), `${invoice.invoiceNumber}.pdf`);
    } catch {
      setError("Could not generate invoice PDF.");
    } finally {
      setMutating(false);
    }
  }

  async function cancelInvoice() {
    if (!invoice) return;
    setMutating(true);
    try {
      await LeadService.markInvoiceCancelled(invoice.id);
      await load();
    } catch {
      setError("Could not cancel invoice.");
    } finally {
      setMutating(false);
    }
  }

  async function markSent() {
    if (!invoice) return;
    setMutating(true);
    try {
      await LeadService.markInvoiceSent(invoice.id);
      await load();
    } catch {
      setError("Could not mark invoice as sent.");
    } finally {
      setMutating(false);
    }
  }

  if (loading) return <main className="mx-auto max-w-[1440px] px-5 py-6 text-sm text-slate-500 lg:px-6">Loading invoice...</main>;

  if (!invoice) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || "Invoice not found."}</p>
        <Link href="/dashboard/invoices" className="mt-4 btn-secondary"><ArrowLeftIcon className="h-4 w-4" />Back to invoices</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/invoices" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeftIcon className="h-4 w-4" />Back to invoices</Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-emerald-600">Invoice</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{invoice.invoiceNumber}</h1>
          <p className="mt-1 text-slate-500">{contactName(invoice.contact)} - {invoice.deal?.title || "General invoice"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={downloadPdf} className="btn-secondary" disabled={mutating}><DownloadIcon className="h-4 w-4" />Download PDF</button>
          <button type="button" onClick={() => setIsPaymentOpen(true)} className="btn-secondary" disabled={mutating || invoice.status === "CANCELLED" || Number(invoice.balanceDue || 0) <= 0}><CreditCardIcon className="h-4 w-4" />Record Payment</button>
          <button type="button" onClick={markSent} className="btn-secondary" disabled={mutating || invoice.status !== "DRAFT"}><CheckCircleIcon className="h-4 w-4" />Mark Sent</button>
          <button type="button" onClick={cancelInvoice} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50" disabled={mutating || invoice.status === "CANCELLED"}>Cancel Invoice</button>
          {invoice.contact && (
            <button
              type="button"
              onClick={() => openWhatsApp(invoice.contact!, `Hello ${contactName(invoice.contact)},\nYour invoice ${invoice.invoiceNumber} is ready. Balance due: ${formatCurrency(invoice.balanceDue)}.`)}
              className="btn-primary"
            >
              <MessageCircleIcon className="h-4 w-4" />
              Open WhatsApp
            </button>
          )}
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 grid gap-4 lg:grid-cols-4">
        {[
          ["Total", invoice.total],
          ["Amount paid", invoice.amountPaid],
          ["Balance due", invoice.balanceDue],
          ["Status", invoice.status.replace("_", " ")],
        ].map(([label, value]) => (
          <article key={label} className="card">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{typeof value === "number" ? formatCurrency(value) : value}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Qty</th>
                  <th className="px-5 py-3">Rate</th>
                  <th className="px-5 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => (
                  <tr key={item.id || item.description}>
                    <td className="px-5 py-4 font-semibold text-slate-900">{item.description}</td>
                    <td className="px-5 py-4 text-slate-600">{item.quantity}</td>
                    <td className="px-5 py-4 text-slate-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-bold text-slate-900">Payment Summary</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p className="flex justify-between"><span>Grand Total</span><strong>{formatCurrency(invoice.total)}</strong></p>
              <p className="flex justify-between"><span>Paid</span><strong>{formatCurrency(invoice.amountPaid)}</strong></p>
              <p className="flex justify-between text-slate-950"><span>Balance Due</span><strong>{formatCurrency(invoice.balanceDue)}</strong></p>
              <p className="flex justify-between"><span>Due Date</span><strong>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "Not set"}</strong></p>
            </div>
            <button type="button" onClick={() => setIsPaymentOpen(true)} className="mt-4 w-full btn-primary" disabled={mutating || invoice.status === "CANCELLED" || Number(invoice.balanceDue || 0) <= 0}><CreditCardIcon className="h-4 w-4" />Record Payment</button>
          </div>
          <div className="card text-sm text-slate-600">
            <h2 className="text-lg font-bold text-slate-900">Details</h2>
            <p className="mt-3">Issue date: {new Date(invoice.issueDate).toLocaleDateString("en-IN")}</p>
            <p>Due date: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "Not set"}</p>
            <p>Payment terms: {invoice.paymentTerms || "On approval"}</p>
            {invoice.quotation && <p>Source quotation: {invoice.quotation.quoteNumber}</p>}
          </div>
        </aside>
      </section>
      {isPaymentOpen && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setIsPaymentOpen(false)}
          onSave={savePayment}
          isSaving={mutating}
        />
      )}
    </main>
  );
}
