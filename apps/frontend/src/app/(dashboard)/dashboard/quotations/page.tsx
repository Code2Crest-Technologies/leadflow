"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/shared/Modal";
import { LeadService } from "@/services";
import type { CompanySettings, Contact, Deal, Invoice, Quotation, QuotationItem } from "@/types";
import { openWhatsApp } from "@/utils";
import { calculateTaxBreakdown } from "@/utils/billing";
import { DownloadIcon, MessageCircleIcon, PencilIcon, PlusIcon, ReceiptIcon, TrashIcon } from "@/components/ui/Icons";

const blankItem = { description: "", quantity: 1, unitPrice: 0 };

const emptyForm = {
  contactId: "",
  dealId: "",
  gstPercent: "18",
  paymentTerms: "On approval",
  terms: "50% advance to start. Balance payable before final handover.",
  status: "DRAFT",
  customerSearch: "",
  items: [
    { description: "Website Development", quantity: 1, unitPrice: 25000 },
    { description: "Hosting", quantity: 1, unitPrice: 5000 },
    { description: "Domain", quantity: 1, unitPrice: 1000 },
  ],
};

type QuotationForm = typeof emptyForm;

const STATUS_OPTIONS = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
const PAYMENT_TERMS_OPTIONS = [
  "On approval",
  "50% advance, 50% before delivery",
  "100% advance",
  "Net 15 days",
  "Net 30 days",
] as const;

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-50 text-blue-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-700",
};

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getContactName(contact?: Contact | Quotation["contact"]) {
  if (!contact) return "Customer";
  if (contact.contactType === "COMPANY") {
    return contact.companyName || contact.contactPersonName || contact.firstName;
  }
  return `${contact.firstName} ${contact.lastName || ""}`.trim();
}

function hasBillingDetails(contact?: Contact) {
  if (!contact) return true;
  return Boolean(contact.addressLine1 && contact.city && contact.state && (contact.postalCode || contact.pincode));
}

function quotationToForm(quotation: Quotation): QuotationForm {
  return {
    contactId: quotation.contactId,
    dealId: quotation.dealId || "",
    gstPercent: String(quotation.gstPercent ?? 18),
    paymentTerms: quotation.paymentTerms || "On approval",
    terms: quotation.terms || "",
    status: quotation.status || "DRAFT",
    customerSearch: "",
    items: quotation.items.length
      ? quotation.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        }))
      : [{ ...blankItem }],
  };
}

function formToPayload(form: QuotationForm) {
  return {
    contactId: form.contactId,
    dealId: form.dealId || "",
    gstPercent: Number(form.gstPercent || 0),
    paymentTerms: form.paymentTerms.trim() || "On approval",
    terms: form.terms,
    status: form.status,
    items: form.items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
      })),
  };
}

function QuotationFormFields({
  form,
  contacts,
  deals,
  selectedContact,
  company,
  totals,
  submitLabel,
  onSubmit,
  onChange,
  onCancel,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  disabled = false,
}: {
  form: QuotationForm;
  contacts: Contact[];
  deals: Deal[];
  selectedContact?: Contact;
  company?: CompanySettings | null;
  totals: { subtotal: number; taxAmount: number; total: number; tax: ReturnType<typeof calculateTaxBreakdown> };
  submitLabel: string;
  onSubmit: (event: FormEvent) => void;
  onChange: (form: QuotationForm) => void;
  onCancel?: () => void;
  onAddItem: () => void;
  onUpdateItem: (index: number, patch: Partial<QuotationItem>) => void;
  onRemoveItem: (index: number) => void;
  disabled?: boolean;
}) {
  const taxPercent = Number(form.gstPercent || 0);
  const selectedPaymentTerm = PAYMENT_TERMS_OPTIONS.includes(
    form.paymentTerms as (typeof PAYMENT_TERMS_OPTIONS)[number],
  )
    ? form.paymentTerms
    : "Custom";
  const taxLabel =
    totals.tax.label === "CGST_SGST"
      ? "CGST + SGST"
      : totals.tax.label === "IGST"
        ? "IGST"
        : totals.tax.label === "TAX_VAT"
          ? "Tax/VAT"
          : "No tax";

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-5">
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Customer & Deal</h2>
          <p className="text-sm text-slate-500">Search customers by name, company, phone, or email.</p>
        </div>
        <input
          className="input-field"
          placeholder="Search customer"
          value={form.customerSearch}
          onChange={(event) => onChange({ ...form, customerSearch: event.target.value })}
          disabled={disabled}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Customer
            <select
              className="input-field mt-1"
              value={form.contactId}
              onChange={(event) => onChange({ ...form, contactId: event.target.value, dealId: "" })}
              required
              disabled={disabled}
            >
              <option value="">Choose customer</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {getContactName(contact)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Deal
            <select
              className="input-field mt-1"
              value={form.dealId}
              onChange={(event) => onChange({ ...form, dealId: event.target.value })}
              disabled={disabled}
            >
              <option value="">No deal</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Quotation status
            <select
              className="input-field mt-1"
              value={form.status}
              onChange={(event) => onChange({ ...form, status: event.target.value })}
              disabled={disabled}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Tax Settings</h2>
          <p className="mt-1 text-sm text-slate-500">
            For India, GST is calculated as CGST+SGST or IGST. For other countries, this can be used as Tax/VAT.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            GST / Tax %
            <input
              className="input-field mt-1"
              type="number"
              min="0"
              max="100"
              value={form.gstPercent}
              onChange={(event) => onChange({ ...form, gstPercent: event.target.value })}
              disabled={disabled}
            />
          </label>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <p className="font-semibold text-slate-900">Tax type</p>
            <p className="mt-1 text-slate-500">{taxPercent ? taxLabel : "No tax"}</p>
            {selectedContact && (
              <p className="mt-1 text-xs text-slate-500">
                Customer: {selectedContact.country || "India"}{selectedContact.state ? `, ${selectedContact.state}` : ""}
              </p>
            )}
            {company && (
              <p className="mt-1 text-xs text-slate-500">
                Company: {company.country || "India"}{company.state ? `, ${company.state}` : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1.5fr]">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Payment Terms</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose common payment terms or enter custom terms for this quotation.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Payment Terms
            <select
              className="input-field mt-1"
              value={selectedPaymentTerm}
              onChange={(event) =>
                onChange({
                  ...form,
                  paymentTerms: event.target.value === "Custom" ? "" : event.target.value,
                })
              }
              disabled={disabled}
            >
              {PAYMENT_TERMS_OPTIONS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Custom / Selected terms
            <input
              className="input-field mt-1"
              value={form.paymentTerms}
              onChange={(event) => onChange({ ...form, paymentTerms: event.target.value })}
              placeholder="50% advance, 50% before delivery"
              disabled={disabled}
            />
          </label>
        </div>
      </section>

      {selectedContact && !hasBillingDetails(selectedContact) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Billing details are incomplete for {getContactName(selectedContact)}.</p>
          <p className="mt-1">
            Add address, city, state, and pincode/postal code in Contacts before generating the final PDF.
          </p>
          <a href="/dashboard/contacts" className="mt-2 inline-block font-semibold underline">
            Edit contact billing details
          </a>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">Line Items</h2>
          <button
            type="button"
            onClick={onAddItem}
            disabled={disabled}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Add item
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
        <div className="grid min-w-[680px] grid-cols-[1.5fr_0.5fr_0.7fr_0.7fr_0.3fr] gap-3 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>Item</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Total</span>
          <span />
        </div>
        {form.items.map((item, index) => (
          <div
            key={index}
            className="grid min-w-[680px] grid-cols-[1.5fr_0.5fr_0.7fr_0.7fr_0.3fr] gap-3 border-t border-slate-100 px-4 py-3"
          >
            <input
              className="input-field"
              placeholder="Website Development"
              value={item.description}
              onChange={(event) => onUpdateItem(index, { description: event.target.value })}
              disabled={disabled}
            />
            <input
              className="input-field"
              type="number"
              min="1"
              value={item.quantity}
              onChange={(event) => onUpdateItem(index, { quantity: Number(event.target.value) })}
              disabled={disabled}
            />
            <input
              className="input-field"
              type="number"
              min="0"
              value={item.unitPrice}
              onChange={(event) => onUpdateItem(index, { unitPrice: Number(event.target.value) })}
              disabled={disabled}
            />
            <p className="self-center text-sm font-semibold text-slate-700">
              {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
            </p>
            <button
              type="button"
              onClick={() => onRemoveItem(index)}
              disabled={disabled || form.items.length <= 1}
              className="self-center text-sm font-semibold text-red-500 disabled:opacity-30"
              title="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-950">Terms</h2>
        <textarea
          className="input-field min-h-28"
          value={form.terms}
          onChange={(event) => onChange({ ...form, terms: event.target.value })}
          placeholder="Terms"
          disabled={disabled}
        />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-950">Totals</h2>
        <div className="min-w-56 text-sm text-slate-600">
          <p className="flex justify-between gap-6">
            <span>Subtotal</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </p>
          <p className="mt-2 flex justify-between gap-6">
            <span>{totals.tax.label === "TAX_VAT" ? "Tax/VAT" : "Tax"}</span>
            <strong>{formatCurrency(totals.taxAmount)}</strong>
          </p>
          {totals.tax.label === "CGST_SGST" && (
            <>
              <p className="mt-2 flex justify-between gap-6">
                <span>CGST</span>
                <strong>{formatCurrency(totals.tax.cgst)}</strong>
              </p>
              <p className="mt-2 flex justify-between gap-6">
                <span>SGST</span>
                <strong>{formatCurrency(totals.tax.sgst)}</strong>
              </p>
            </>
          )}
          {totals.tax.label === "IGST" && (
            <p className="mt-2 flex justify-between gap-6">
              <span>IGST</span>
              <strong>{formatCurrency(totals.tax.igst)}</strong>
            </p>
          )}
          {totals.tax.label === "TAX_VAT" && (
            <p className="mt-2 flex justify-between gap-6">
              <span>Tax/VAT</span>
              <strong>{formatCurrency(totals.tax.taxVat)}</strong>
            </p>
          )}
          <p className="mt-2 flex justify-between gap-6 text-lg text-slate-950">
            <span>Grand Total</span>
            <strong>{formatCurrency(totals.total)}</strong>
          </p>
        </div>
        </div>
      </section>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={disabled} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={disabled}>
          {disabled ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingPrefill, setPendingPrefill] = useState<{ contactId: string; dealId: string } | null>(null);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [quotationData, invoiceData, contactData, dealData, companyData] = await Promise.all([
        LeadService.getQuotations(),
        LeadService.getInvoices(),
        LeadService.getContacts(),
        LeadService.getDeals(),
        LeadService.getCompany(),
      ]);
      setQuotations(quotationData);
      setInvoices(invoiceData);
      setContacts(contactData);
      setDeals(dealData);
      setCompany(companyData);
    } catch {
      setError("Could not load quotations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const contactId = params.get("contactId") || "";
    const dealId = params.get("dealId") || "";
    if (!contactId && !dealId) return;
    setPendingPrefill({ contactId, dealId });
  }, []);

  useEffect(() => {
    if (!pendingPrefill) return;
    const { contactId, dealId } = pendingPrefill;
    if (!contactId && !dealId) return;
    if (!contacts.length || !deals.length) return;

    const deal = dealId ? deals.find((item) => item.id === dealId) : undefined;
    setEditingId("");
    setShowForm(true);
    setForm({
      ...emptyForm,
      contactId: contactId || deal?.contactId || "",
      dealId: dealId || "",
      customerSearch: "",
      items: deal
        ? [{ description: deal.title, quantity: 1, unitPrice: Number(deal.value || 0) }]
        : emptyForm.items,
    });
    setPendingPrefill(null);
  }, [contacts, deals, pendingPrefill]);

  const filteredDeals = useMemo(() => {
    if (!form.contactId) return deals;
    return deals.filter((deal) => deal.contactId === form.contactId);
  }, [deals, form.contactId]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === form.contactId),
    [contacts, form.contactId],
  );

  const filteredContacts = useMemo(() => {
    const query = form.customerSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [
        getContactName(contact),
        contact.companyName,
        contact.contactPersonName,
        contact.phoneNumber,
        contact.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [contacts, form.customerSearch]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
    const tax = calculateTaxBreakdown({
      subtotal,
      taxPercent: Number(form.gstPercent || 0),
      companyCountry: company?.country,
      companyState: company?.state,
      customerCountry: selectedContact?.country,
      customerState: selectedContact?.state,
    });
    return { subtotal, taxAmount: tax.totalTax, total: subtotal + tax.totalTax, tax };
  }, [company?.country, company?.state, form.gstPercent, form.items, selectedContact?.country, selectedContact?.state]);

  const filteredQuotations = useMemo(() => {
    if (statusFilter === "ALL") return quotations;
    return quotations.filter((q) => q.status === statusFilter);
  }, [quotations, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: quotations.length };
    STATUS_OPTIONS.forEach((status) => {
      counts[status] = quotations.filter((q) => q.status === status).length;
    });
    return counts;
  }, [quotations]);

  const invoiceByQuotationId = useMemo(() => {
    return invoices.reduce<Record<string, Invoice>>((record, invoice) => {
      if (invoice.quotationId) record[invoice.quotationId] = invoice;
      return record;
    }, {});
  }, [invoices]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
    setShowForm(false);
  }

  function startEdit(quotation: Quotation) {
    setError("");
    setEditingId(quotation.id);
    setForm(quotationToForm(quotation));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);

    const payload = formToPayload(form);
    if (!payload.items.length) {
      setError("Add at least one line item with a description.");
      setMutating(false);
      return;
    }

    try {
      if (editingId) {
        await LeadService.updateQuotation(editingId, payload);
      } else {
        await LeadService.createQuotation(payload);
      }
      resetForm();
      await load();
    } catch {
      setError(
        editingId
          ? "Could not update quotation. Check all fields and try again."
          : "Could not create quotation. Choose a customer and add at least one item.",
      );
    } finally {
      setMutating(false);
    }
  }

  function updateItem(index: number, patch: Partial<QuotationItem>) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function removeItem(index: number) {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  }

  async function downloadPdf(quotation: Quotation) {
    setError("");
    setMutating(true);
    try {
      const blob = await LeadService.downloadQuotationPdf(quotation.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${quotation.quoteNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate PDF. Try again.");
    } finally {
      setMutating(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    setError("");
    try {
      downloadBlob(await LeadService.downloadExport("quotations", statusFilter === "ALL" ? {} : { status: statusFilter }), "leadflow-quotations.csv");
    } catch {
      setError("Could not export quotations. Admin or manager access may be required.");
    }
  }

  async function convertToInvoice(quotation: Quotation) {
    setError("");
    setMutating(true);
    try {
      const invoice = await LeadService.convertQuotationToInvoice(quotation.id);
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch {
      setError("Only accepted quotations can be converted, and each quotation can be invoiced once.");
    } finally {
      setMutating(false);
    }
  }

  async function updateStatus(quotationId: string, status: string) {
    setError("");
    setMutating(true);
    try {
      await LeadService.updateQuotationStatus(quotationId, status);
      await load();
    } catch {
      setError("Could not update quotation status.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteQuotation(id: string, quoteNumber: string) {
    const confirmed = window.confirm(`Delete quotation ${quoteNumber} permanently?`);
    if (!confirmed) return;

    setError("");
    setMutating(true);
    try {
      await LeadService.deleteQuotation(id);
      if (editingId === id) resetForm();
      if (expandedId === id) setExpandedId("");
      await load();
    } catch {
      setError("Could not delete quotation.");
    } finally {
      setMutating(false);
    }
  }

  function sendWhatsApp(quotation: Quotation) {
    if (!quotation.contact) return;
    openWhatsApp(
      quotation.contact,
      `Hello ${getContactName(quotation.contact)},\nYour quotation ${quotation.quoteNumber} is ready. Total: ${formatCurrency(quotation.total)}.`,
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Quotation Module
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Quotations</h1>
          <p className="mt-1 text-slate-500">
            Build quotes, generate PDFs, and send them over WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingId) {
                setShowForm(false);
              } else {
                resetForm();
                setShowForm(true);
              }
            }}
            className="btn-primary"
          >
            {!showForm && <PlusIcon className="h-4 w-4" />}
            {showForm ? "Close form" : "Create quotation"}
          </button>
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <Modal
        open={showForm}
        title={editingId ? "Edit Quotation" : "Create Quotation"}
        description="Build a quotation, validate billing details, and convert accepted quotes into invoices."
        onClose={resetForm}
        size="full"
      >
        <QuotationFormFields
          form={form}
          contacts={filteredContacts}
          deals={filteredDeals}
          selectedContact={selectedContact}
          company={company}
          totals={totals}
          submitLabel={editingId ? "Update quotation" : "Save quotation"}
          onSubmit={submit}
          onChange={setForm}
          onCancel={resetForm}
          onAddItem={() => setForm({ ...form, items: [...form.items, { ...blankItem }] })}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          disabled={mutating}
        />
      </Modal>

      <div className="mt-6 flex flex-wrap gap-2">
        {["ALL", ...STATUS_OPTIONS].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
              statusFilter === status
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            }`}
          >
            {status === "ALL" ? "All" : status} ({statusCounts[status] ?? 0})
          </button>
        ))}
      </div>

      <section className="mt-6 grid gap-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading quotations...</p>
        ) : filteredQuotations.length ? (
          filteredQuotations.map((quotation) => (
            <article
              key={quotation.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-700">
                    {quotation.quoteNumber}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {getContactName(quotation.contact)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {quotation.deal?.title || "General quotation"} -{" "}
                    {new Date(quotation.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-950">
                    {formatCurrency(quotation.total)}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-bold ${statusStyles[quotation.status] || "bg-slate-100 text-slate-600"}`}
                  >
                    {quotation.status}
                  </span>
                </div>
              </div>

              {expandedId === quotation.id && quotation.items?.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                  <div className="grid min-w-[560px] grid-cols-[1.5fr_0.5fr_0.7fr_0.7fr] gap-3 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <span>Item</span>
                    <span>Qty</span>
                    <span>Rate</span>
                    <span>Total</span>
                  </div>
                  {quotation.items.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="grid min-w-[560px] grid-cols-[1.5fr_0.5fr_0.7fr_0.7fr] gap-3 border-t border-slate-100 px-4 py-2 text-sm"
                    >
                      <span>{item.description}</span>
                      <span>{item.quantity}</span>
                      <span>{formatCurrency(item.unitPrice)}</span>
                      <span className="font-semibold">
                        {formatCurrency(Number(item.quantity) * Number(item.unitPrice))}
                      </span>
                    </div>
                  ))}
                  {quotation.terms && (
                    <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                      Terms: {quotation.terms}
                    </p>
                  )}
                  <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                    Payment terms: {quotation.paymentTerms || "On approval"}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === quotation.id ? "" : quotation.id)
                  }
                  className="btn-secondary h-9 px-3"
                >
                  {expandedId === quotation.id ? "Hide items" : "View items"}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(quotation)}
                  disabled={mutating}
                  className="btn-secondary h-9 px-3"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => downloadPdf(quotation)}
                  disabled={mutating}
                  className="btn-secondary h-9 px-3"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => sendWhatsApp(quotation)}
                  className="btn-primary h-9 px-3"
                >
                  <MessageCircleIcon className="h-4 w-4" />
                  Open WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const existingInvoice = invoiceByQuotationId[quotation.id];
                    if (existingInvoice) {
                      router.push(`/dashboard/invoices/${existingInvoice.id}`);
                      return;
                    }
                    void convertToInvoice(quotation);
                  }}
                  disabled={mutating || (!invoiceByQuotationId[quotation.id] && quotation.status !== "ACCEPTED")}
                  className="btn-secondary h-9 px-3 text-emerald-700"
                  title={invoiceByQuotationId[quotation.id] ? "View linked invoice" : quotation.status === "ACCEPTED" ? "Convert this quotation to invoice" : "Mark quotation as ACCEPTED before converting"}
                >
                  <ReceiptIcon className="h-4 w-4" />
                  {invoiceByQuotationId[quotation.id] ? "View Invoice" : "Convert to Invoice"}
                </button>
                <select
                  value={quotation.status}
                  onChange={(event) => updateStatus(quotation.id, event.target.value)}
                  disabled={mutating}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      Mark as {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => deleteQuotation(quotation.id, quotation.quoteNumber)}
                  disabled={mutating}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
            {statusFilter === "ALL"
              ? "No quotations yet. Create QT-2026-0001-style quotes from the form above."
              : `No ${statusFilter.toLowerCase()} quotations.`}
          </p>
        )}
      </section>
    </main>
  );
}
