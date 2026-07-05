"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RecordPaymentModal from "@/components/invoices/RecordPaymentModal";
import ContactSearchSelect from "@/components/shared/ContactSearchSelect";
import { LeadService } from "@/services";
import type { Contact, Deal, Invoice, InvoiceItem } from "@/types";
import { openWhatsApp } from "@/utils";
import { calculateTaxBreakdown } from "@/utils/billing";
import { CreditCardIcon, DownloadIcon, MessageCircleIcon, PlusIcon } from "@/components/ui/Icons";

const blankItem = { description: "", quantity: 1, unitPrice: 0 };
const statusOptions = ["ALL", "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"] as const;
const manualStatusOptions = ["DRAFT", "SENT", "CANCELLED"] as const;

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  PAID: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const emptyForm = {
  contactId: "",
  dealId: "",
  dueDate: "",
  taxPercent: "18",
  paymentTerms: "On approval",
  terms: "Payment due as per agreed terms.",
  notes: "",
  items: [{ description: "Website Development", quantity: 1, unitPrice: 25000 }],
};

type InvoiceForm = typeof emptyForm;

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function contactName(contact?: Contact | Invoice["contact"]) {
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

function formPayload(form: InvoiceForm) {
  return {
    contactId: form.contactId,
    dealId: form.dealId || "",
    dueDate: form.dueDate || undefined,
    taxPercent: Number(form.taxPercent || 0),
    paymentTerms: form.paymentTerms.trim() || "On approval",
    terms: form.terms,
    notes: form.notes,
    items: form.items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
      })),
  };
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("ALL");
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [invoiceData, contactData, dealData] = await Promise.all([
        LeadService.getInvoices(),
        LeadService.getContacts(),
        LeadService.getDeals(),
      ]);
      setInvoices(invoiceData);
      setContacts(contactData);
      setDeals(dealData);
    } catch {
      setError("Could not load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedContact = contacts.find((contact) => contact.id === form.contactId);
  const filteredDeals = form.contactId ? deals.filter((deal) => deal.contactId === form.contactId) : [];
  const filteredInvoices = statusFilter === "ALL" ? invoices : invoices.filter((invoice) => invoice.status === statusFilter);
  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const tax = calculateTaxBreakdown({
      subtotal,
      taxPercent: Number(form.taxPercent || 0),
      customerCountry: selectedContact?.country,
      customerState: selectedContact?.state,
    });
    return { subtotal, taxAmount: tax.totalTax, total: subtotal + tax.totalTax, tax };
  }, [form.items, form.taxPercent, selectedContact?.country, selectedContact?.state]);

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);
    const payload = formPayload(form);
    if (!payload.items.length) {
      setError("Add at least one invoice item.");
      setMutating(false);
      return;
    }

    try {
      await LeadService.createInvoice(payload);
      resetForm();
      await load();
    } catch {
      setError("Could not create invoice. Choose a customer and check line items.");
    } finally {
      setMutating(false);
    }
  }

  async function downloadPdf(invoice: Invoice) {
    setError("");
    setMutating(true);
    try {
      downloadBlob(await LeadService.downloadInvoicePdf(invoice.id), `${invoice.invoiceNumber}.pdf`);
    } catch {
      setError("Could not generate invoice PDF.");
    } finally {
      setMutating(false);
    }
  }

  async function exportCsv() {
    setError("");
    try {
      downloadBlob(await LeadService.downloadExport("invoices", statusFilter === "ALL" ? {} : { status: statusFilter }), "leadflow-invoices.csv");
    } catch {
      setError("Could not export invoices. Admin or manager access may be required.");
    }
  }

  async function savePayment(payload: { amountReceived: number; paymentDate: string; notes?: string }) {
    if (!paymentInvoice) return;
    setError("");
    setUpdatingInvoiceId(paymentInvoice.id);
    try {
      await LeadService.updateInvoicePayment(paymentInvoice.id, payload);
      setPaymentInvoice(null);
      await load();
    } catch {
      setError("Could not update invoice payment.");
    } finally {
      setUpdatingInvoiceId("");
    }
  }

  async function markSent(invoice: Invoice) {
    setError("");
    setUpdatingInvoiceId(invoice.id);
    try {
      await LeadService.markInvoiceSent(invoice.id);
      await load();
    } catch {
      setError("Could not mark invoice as sent.");
    } finally {
      setUpdatingInvoiceId("");
    }
  }

  async function updateStatus(invoice: Invoice, status: string) {
    setError("");
    setUpdatingInvoiceId(invoice.id);
    try {
      if (status === "SENT") {
        await LeadService.markInvoiceSent(invoice.id);
      } else if (status === "CANCELLED") {
        await LeadService.markInvoiceCancelled(invoice.id);
      } else {
        await LeadService.updateInvoiceStatus(invoice.id, status);
      }
      await load();
    } catch {
      setError("Could not update invoice status.");
    } finally {
      setUpdatingInvoiceId("");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Billing</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Invoices</h1>
          <p className="mt-1 text-slate-500">Create invoices, record payments, and download client-ready PDFs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary"><DownloadIcon className="h-4 w-4" />Export CSV</button>
          <button type="button" onClick={() => (showForm ? resetForm() : setShowForm(true))} className="btn-primary">
            {!showForm && <PlusIcon className="h-4 w-4" />}
            {showForm ? "Close form" : "Create invoice"}
          </button>
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="card mt-6 space-y-5">
          <section>
            <h2 className="text-lg font-bold text-slate-950">Customer & Billing</h2>
            <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <ContactSearchSelect
                contacts={contacts}
                value={form.contactId}
                onChange={(contactId) => setForm({ ...form, contactId, dealId: "" })}
                disabled={mutating}
                required
              />
              <label className="text-sm font-semibold text-slate-700">
                Deal
                <select
                  className="input-field mt-1"
                  value={form.dealId}
                  onChange={(event) => setForm({ ...form, dealId: event.target.value })}
                  disabled={mutating || !form.contactId}
                >
                  <option value="">{form.contactId ? "No deal" : "Select contact first"}</option>
                  {filteredDeals.map((deal) => (
                    <option key={deal.id} value={deal.id}>{deal.title}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            <label className="text-sm font-semibold text-slate-700">
              Due date
              <input className="input-field mt-1" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} disabled={mutating} />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              GST / Tax %
              <input className="input-field mt-1" type="number" min="0" max="100" value={form.taxPercent} onChange={(event) => setForm({ ...form, taxPercent: event.target.value })} disabled={mutating} />
            </label>
            <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
              Payment terms
              <input className="input-field mt-1" value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} disabled={mutating} />
            </label>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-950">Line Items</h2>
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { ...blankItem }] })} className="btn-secondary" disabled={mutating}><PlusIcon className="h-4 w-4" />Add item</button>
            </div>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <div className="grid min-w-[680px] grid-cols-[1.5fr_0.4fr_0.6fr_0.6fr_0.25fr] gap-3 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <span>Item</span><span>Qty</span><span>Rate</span><span>Total</span><span />
              </div>
              {form.items.map((item, index) => (
                <div key={index} className="grid min-w-[680px] grid-cols-[1.5fr_0.4fr_0.6fr_0.6fr_0.25fr] gap-3 border-t border-slate-100 px-4 py-3">
                  <input className="input-field" placeholder="Service description" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} disabled={mutating} />
                  <input className="input-field" type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} disabled={mutating} />
                  <input className="input-field" type="number" min="0" value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} disabled={mutating} />
                  <p className="self-center text-sm font-semibold">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</p>
                  <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })} disabled={mutating || form.items.length <= 1} className="text-sm font-bold text-red-500 disabled:opacity-30">x</button>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Terms
              <textarea className="input-field mt-1 min-h-24" value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} disabled={mutating} />
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></p>
              <p className="mt-2 flex justify-between"><span>Tax</span><strong>{formatCurrency(totals.taxAmount)}</strong></p>
              <p className="mt-3 flex justify-between text-lg text-slate-950"><span>Grand Total</span><strong>{formatCurrency(totals.total)}</strong></p>
              <p className="mt-3 text-xs text-slate-500">Tax mode: {totals.tax.label.replace("_", " ")}</p>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="btn-secondary" disabled={mutating}>Cancel</button>
            <button className="btn-primary" disabled={mutating || !form.contactId}>{mutating ? "Saving..." : "Save invoice"}</button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusFilter === status ? "bg-[var(--color-primary)] text-white" : "bg-white text-slate-600 shadow-sm"}`}
          >
            {status === "ALL" ? "All" : status.replace("_", " ")}
          </button>
        ))}
      </div>

      <section className="mt-6 grid gap-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading invoices...</p>
        ) : filteredInvoices.length ? (
          filteredInvoices.map((invoice) => (
            <article key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">{invoice.invoiceNumber}</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">{contactName(invoice.contact)}</h2>
                  <p className="mt-1 text-sm text-slate-500">{invoice.deal?.title || "General invoice"} - Due {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "not set"}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-950">{formatCurrency(invoice.balanceDue)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Balance due</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-bold ${statusStyles[invoice.status] || statusStyles.DRAFT}`}>
                    {invoice.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/dashboard/invoices/${invoice.id}`} className="btn-secondary">View</Link>
                <button type="button" onClick={() => downloadPdf(invoice)} className="btn-secondary" disabled={mutating}><DownloadIcon className="h-4 w-4" />Download PDF</button>
                <select
                  className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  value={manualStatusOptions.includes(invoice.status as (typeof manualStatusOptions)[number]) ? invoice.status : ""}
                  onChange={(event) => event.target.value && updateStatus(invoice, event.target.value)}
                  disabled={Boolean(updatingInvoiceId) || invoice.status === "PAID"}
                >
                  <option value="">Status action</option>
                  {manualStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ")}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => markSent(invoice)} className="btn-secondary" disabled={Boolean(updatingInvoiceId) || invoice.status !== "DRAFT"}>Mark sent</button>
                <button
                  type="button"
                  onClick={() => setPaymentInvoice(invoice)}
                  className="btn-secondary"
                  disabled={Boolean(updatingInvoiceId) || invoice.status === "CANCELLED" || Number(invoice.balanceDue || 0) <= 0}
                >
                  <CreditCardIcon className="h-4 w-4" />
                  Record payment
                </button>
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
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
            No invoices yet. Convert an accepted quotation or create a manual invoice.
          </p>
        )}
      </section>
      {paymentInvoice && (
        <RecordPaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSave={savePayment}
          isSaving={updatingInvoiceId === paymentInvoice.id}
        />
      )}
    </main>
  );
}
