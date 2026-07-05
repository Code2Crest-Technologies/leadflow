"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/shared/Modal";
import { LeadService } from "@/services";
import type { Contact, Deal, Invoice, Quotation } from "@/types";
import { openWhatsApp } from "@/utils";
import { DownloadIcon, MessageCircleIcon, PencilIcon, PlusIcon } from "@/components/ui/Icons";
import {
  DEAL_STAGE_OPTIONS,
  PIPELINE_BOARD_STAGES,
  getPipelineValue,
  sumDealValues,
  type PipelineStage,
} from "@/utils/dealStages";

const stageColors: Record<PipelineStage, string> = {
  PROSPECT: "bg-[var(--color-primary)]",
  QUALIFICATION: "bg-[var(--color-accent)]",
  PROPOSAL: "bg-[var(--color-primary)]",
  NEGOTIATION: "bg-[var(--color-accent)]",
  WON: "bg-[var(--color-primary)]",
};

const stageProbability: Record<string, string> = {
  PROSPECT: "10",
  QUALIFICATION: "30",
  PROPOSAL: "60",
  NEGOTIATION: "80",
  WON: "100",
  LOST: "0",
};

const emptyDealForm = {
  contactId: "",
  title: "",
  value: "0",
  stage: "PROSPECT",
  probability: "10",
};

function PipelineContent() {
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDealId, setEditingDealId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [form, setForm] = useState(emptyDealForm);
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
  const pipelineValue = getPipelineValue(deals);

  function contactName(contact: Contact) {
    return contact.companyName || `${contact.firstName} ${contact.lastName || ""}`.trim();
  }

  function contactLabel(contact: Contact) {
    return [contactName(contact), contact.phoneNumber, contact.email].filter(Boolean).join(" - ");
  }

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === form.contactId),
    [contacts, form.contactId],
  );
  const previewContactName = selectedContact ? contactName(selectedContact) : "No contact selected";
  const previewValue = currencyFormatter.format(Number(form.value || 0));

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contactName(contact), contact.phoneNumber, contact.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [contactSearch, contacts]);

  function chooseContact(contact: Contact) {
    setForm((current) => ({ ...current, contactId: contact.id }));
    setContactSearch(contactLabel(contact));
    setIsContactPickerOpen(false);
  }

  function resetForm() {
    setForm(emptyDealForm);
    setEditingDealId("");
    setContactSearch("");
    setIsContactPickerOpen(false);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
  }

  function openCreateForm() {
    if (showForm) {
      closeForm();
      return;
    }

    resetForm();
    setShowForm(true);
  }

  function startEdit(deal: Deal) {
    setError("");
    setEditingDealId(deal.id);
    setShowForm(true);
    setForm({
      contactId: deal.contactId,
      title: deal.title,
      value: String(deal.value ?? 0),
      stage: deal.stage || "PROSPECT",
      probability: String(deal.probability ?? stageProbability[deal.stage] ?? 10),
    });

    const contact = contacts.find((item) => item.id === deal.contactId);
    setContactSearch(contact ? contactLabel(contact) : "");
    setIsContactPickerOpen(false);
  }

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [dealData, contactData, quotationData, invoiceData] = await Promise.all([
        LeadService.getDeals(),
        LeadService.getContacts(),
        LeadService.getQuotations(),
        LeadService.getInvoices(),
      ]);
      setDeals(dealData);
      setContacts(contactData);
      setQuotations(quotationData);
      setInvoices(invoiceData);
    } catch {
      setError("Could not load pipeline data.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const contactId = searchParams.get("contactId");
    const shouldOpen = contactId || searchParams.get("openForm") === "1";

    if (shouldOpen) {
      setShowForm(true);
    }

    if (contactId) {
      setForm((current) => ({ ...current, contactId }));
      const contact = contacts.find((item) => item.id === contactId);
      if (contact) setContactSearch(contactLabel(contact));
    }
  }, [contacts, searchParams]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);

    try {
      const payload = { ...form, currency: "INR" };
      if (editingDealId) {
        await LeadService.updateDeal(editingDealId, payload);
      } else {
        await LeadService.createDeal(payload);
      }
      closeForm();
      await load();
    } catch {
      setError(`Could not ${editingDealId ? "update" : "create"} deal. Choose a contact and add a title.`);
    } finally {
      setMutating(false);
    }
  }

  async function move(id: string, stage: string) {
    setError("");
    setMutating(true);
    try {
      await LeadService.updateDealStage(id, stage);
      await load();
    } catch {
      setError("Could not move deal stage.");
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
      downloadBlob(await LeadService.downloadExport("deals"), "leadflow-deals.csv");
    } catch {
      setError("Could not export deals. Admin or manager access may be required.");
    }
  }

  const quotationByDealId = useMemo(() => {
    return quotations.reduce<Record<string, Quotation>>((record, quotation) => {
      if (quotation.dealId) record[quotation.dealId] = quotation;
      return record;
    }, {});
  }, [quotations]);

  const invoiceByQuotationId = useMemo(() => {
    return invoices.reduce<Record<string, Invoice>>((record, invoice) => {
      if (invoice.quotationId) record[invoice.quotationId] = invoice;
      return record;
    }, {});
  }, [invoices]);

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] overflow-x-hidden bg-[var(--color-bg)] px-5 py-6 lg:px-6">
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Revenue Pipeline
          </span>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Sales Pipeline
          </h1>

          <p className="mt-2 text-slate-500">
            Track opportunities and convert more leads into customers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={openCreateForm}
            disabled={mutating}
            className="btn-primary"
          >
            {!showForm && <PlusIcon className="h-4 w-4" />}
            {showForm ? "Close form" : "Create Deal"}
          </button>
        </div>
      </header>
      {error && <p className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mb-6 mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Total Deals</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {deals.length}
          </h2>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Won Deals</p>
          <h2 className="mt-2 text-3xl font-bold text-emerald-600">
            {deals.filter((d) => d.stage === "WON").length}
          </h2>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Lost Deals</p>
          <h2 className="mt-2 text-3xl font-bold text-red-500">
            {deals.filter((d) => d.stage === "LOST").length}
          </h2>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500">Pipeline Value</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {currencyFormatter.format(pipelineValue)}
          </h2>
        </div>
      </div>

      <Modal
        open={showForm}
        title={editingDealId ? "Edit Deal" : "Create Deal"}
        description="Link a contact, define the scope, set win probability, and place it in the right stage."
        onClose={closeForm}
        size="full"
      >
        <form onSubmit={submit} className="min-h-[520px] space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
                {editingDealId ? "Edit Opportunity" : "New Opportunity"}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                {editingDealId ? "Edit Deal" : "Create Deal"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Link a contact, define the scope, set win probability, and place it in the right stage.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={closeForm}
                disabled={mutating}
                className="btn-secondary"
              >
                Close form
              </button>
              <button className="btn-primary" disabled={mutating || !form.contactId || !form.title.trim()}>
                {mutating ? "Saving..." : editingDealId ? "Save changes" : "Save deal"}
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Contact
                  <div className="relative mt-1">
                    <input
                      required
                      className="input-field w-full"
                      placeholder="Search contact by name, phone, or email..."
                      value={contactSearch}
                      onBlur={() => window.setTimeout(() => setIsContactPickerOpen(false), 160)}
                      onChange={(event) => {
                        setContactSearch(event.target.value);
                        setForm({ ...form, contactId: "" });
                        setIsContactPickerOpen(true);
                      }}
                      onFocus={() => setIsContactPickerOpen(true)}
                      disabled={mutating}
                    />
                    {isContactPickerOpen && (
                      <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-xl">
                        {filteredContacts.length ? (
                          filteredContacts.map((contact) => (
                            <button
                              key={contact.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                chooseContact(contact);
                              }}
                              className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                                selectedContact?.id === contact.id ? "bg-emerald-50" : ""
                              }`}
                            >
                              <span className="block font-semibold text-slate-900">{contactName(contact)}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {[contact.phoneNumber, contact.email].filter(Boolean).join(" - ")}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-4 py-3 text-sm text-slate-500">No contacts found.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="mt-2 block text-xs font-normal text-slate-500">
                    Search and select the customer this opportunity belongs to.
                  </span>
                </label>

                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Deal title
                  <input
                    required
                    className="input-field mt-1"
                    placeholder="Website redesign, CRM setup..."
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    disabled={mutating}
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Value
                  <input
                    className="input-field mt-1"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    disabled={mutating}
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Stage
                  <select
                    className="input-field mt-1"
                    value={form.stage}
                    onChange={(e) => {
                      const stage = e.target.value;
                      setForm({ ...form, stage, probability: stageProbability[stage] ?? form.probability });
                    }}
                    disabled={mutating}
                  >
                    {DEAL_STAGE_OPTIONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                  Win probability
                  <div className="mt-1 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="10"
                      value={form.probability}
                      onChange={(e) => setForm({ ...form, probability: e.target.value })}
                      disabled={mutating}
                    />
                    <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      {form.probability || 0}% chance
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                Deal Preview
              </p>
              <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <p className="text-sm text-slate-500">Customer</p>
                <h3 className="mt-1 truncate text-lg font-bold text-slate-950">{previewContactName}</h3>
                {selectedContact && (
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {[selectedContact.phoneNumber, selectedContact.email].filter(Boolean).join(" - ")}
                  </p>
                )}
                <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                  <p className="text-sm text-slate-500">Opportunity</p>
                  <p className="mt-1 text-xl font-bold text-slate-950">
                    {form.title.trim() || "Untitled deal"}
                  </p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Value</p>
                    <p className="mt-1 font-bold text-slate-950">{previewValue}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Stage</p>
                    <p className="mt-1 font-bold text-slate-950">{form.stage}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-emerald-50 p-3">
                    <p className="text-emerald-700">Win probability</p>
                    <p className="mt-1 font-bold text-emerald-800">{form.probability || 0}%</p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                This preview updates as you type, so you can confirm the deal before saving it to the pipeline.
              </p>
            </aside>
          </div>
        </form>
      </Modal>
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
        {PIPELINE_BOARD_STAGES.map((stage) => {
          const stageDeals = deals.filter((deal) => deal.stage === stage);
          const stageValue = sumDealValues(stageDeals);

          return (
            <div
              key={stage}
              className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
            <div className={`${stageColors[stage]} sticky top-0 z-10 rounded-2xl p-3 text-white shadow-sm`}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{stage}</h2>

                <span className="rounded-full bg-white/20 px-2 py-1 text-xs">
                  {stageDeals.length} {stageDeals.length === 1 ? "deal" : "deals"}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold">{currencyFormatter.format(stageValue)}</p>
            </div>
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
              {loading ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Loading deals...
                </p>
              ) : stageDeals.map((deal) => (
                  <article
                    key={deal.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--color-accent)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
                        {deal.contact?.firstName?.charAt(0)}
                      </div>

                      <div>
                        <p className="font-semibold">
                          {deal.contact?.firstName} {deal.contact?.lastName}
                        </p>

                        <p className="text-xs text-slate-500">Customer</p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/deals/${deal.id}`}
                      className="mt-4 block text-lg font-bold text-slate-900 hover:text-emerald-700"
                    >
                      {deal.title}
                    </Link>

                    <p className="mt-3 text-lg font-bold text-slate-950">
                      {currencyFormatter.format(Number(deal.value || 0))}
                    </p>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {deal.probability ?? stageProbability[deal.stage] ?? 0}% Win probability
                    </span>
                    <select
                      className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm transition focus:border-emerald-500 focus:outline-none"
                      value={deal.stage}
                      onChange={(e) => move(deal.id, e.target.value)}
                      disabled={mutating}
                    >
                      {DEAL_STAGE_OPTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    {deal.contact?.phoneNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          openWhatsApp(
                            deal.contact!,
                            `Hello ${deal.contact!.firstName},\nYour quotation is ready.`,
                          )
                        }
                        className="btn-primary mt-3 w-full"
                      >
                        <MessageCircleIcon className="h-4 w-4" />
                        Open WhatsApp
                      </button>
                    )}
                    {deal.stage === "WON" && (
                      (() => {
                        const quotation = quotationByDealId[deal.id];
                        const invoice = quotation ? invoiceByQuotationId[quotation.id] : undefined;

                        if (invoice) {
                          return (
                            <Link href={`/dashboard/invoices/${invoice.id}`} className="btn-secondary mt-3 w-full">
                              <PlusIcon className="h-4 w-4" />
                              View Invoice
                            </Link>
                          );
                        }

                        if (quotation) {
                          return (
                            <Link href="/dashboard/quotations" className="btn-secondary mt-3 w-full">
                              <PlusIcon className="h-4 w-4" />
                              View Quotation
                            </Link>
                          );
                        }

                        return (
                          <Link href={`/dashboard/quotations?dealId=${deal.id}&contactId=${deal.contactId}`} className="btn-secondary mt-3 w-full">
                            <PlusIcon className="h-4 w-4" />
                            Create Quotation
                          </Link>
                        );
                      })()
                    )}
                    <button type="button" onClick={() => startEdit(deal)} disabled={mutating} className="btn-secondary mt-3 w-full">
                      <PencilIcon className="h-4 w-4" />
                      Edit deal
                    </button>
                  </article>
                ))}
              {!loading && stageDeals.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No deals in this stage.
                </p>
              )}
            </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<main className="p-6 lg:p-10 text-sm text-slate-500">Loading pipeline...</main>}>
      <PipelineContent />
    </Suspense>
  );
}
