"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/shared/Modal";
import { LeadService } from "@/services";
import type { Contact, ContactGroup } from "@/types";
import { openWhatsApp } from "@/utils";
import { COUNTRIES, INDIAN_STATES, defaultPhoneCode, isIndia } from "@/utils/billing";
import { DownloadIcon, MessageCircleIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";

const emptyForm = {
  contactType: "PERSON",
  firstName: "",
  lastName: "",
  companyName: "",
  contactPersonName: "",
  phoneCountryCode: "+91",
  phoneNumber: "",
  email: "",
  country: "India",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  postalCode: "",
  gstin: "",
  taxId: "",
  groupId: "",
  segment: "LEAD",
};

type ContactFormState = typeof emptyForm;

function contactToForm(contact: Contact): ContactFormState {
  return {
    contactType: contact.contactType || "PERSON",
    firstName: contact.firstName || "",
    lastName: contact.lastName || "",
    companyName: contact.companyName || "",
    contactPersonName: contact.contactPersonName || "",
    phoneCountryCode: contact.phoneCountryCode || "+91",
    phoneNumber: contact.phoneNumber || "",
    email: contact.email || "",
    country: contact.country || "India",
    addressLine1: contact.addressLine1 || "",
    addressLine2: contact.addressLine2 || "",
    city: contact.city || "",
    state: contact.state || "",
    pincode: contact.pincode || "",
    postalCode: contact.postalCode || contact.pincode || "",
    gstin: contact.gstin || "",
    taxId: contact.taxId || "",
    groupId: contact.groupId || "",
    segment: contact.segment || "LEAD",
  };
}

function getContactName(contact: Contact) {
  if (contact.contactType === "COMPANY") {
    return contact.companyName || contact.contactPersonName || contact.firstName;
  }
  return `${contact.firstName} ${contact.lastName || ""}`.trim();
}

function parseCsvPreview(csvText: string) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => line.split(",").map((value) => value.trim()));
}

function ContactForm({
  form,
  groups,
  mutating,
  editingId,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: ContactFormState;
  groups: ContactGroup[];
  mutating: boolean;
  editingId: string;
  error: string;
  onChange: (form: ContactFormState) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  function updateCountry(country: string) {
    onChange({
      ...form,
      country,
      phoneCountryCode:
        !form.phoneCountryCode || form.phoneCountryCode === defaultPhoneCode(form.country)
          ? defaultPhoneCode(country)
          : form.phoneCountryCode,
      state: isIndia(country) ? form.state : "",
      gstin: isIndia(country) ? form.gstin : "",
      taxId: isIndia(country) ? "" : form.taxId,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Contact Type</h2>
          <p className="text-sm text-slate-500">Choose whether this billing profile is for a person or company.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["PERSON", "COMPANY"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ ...form, contactType: type, gstin: type === "COMPANY" ? form.gstin : "" })}
              disabled={mutating}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                form.contactType === type
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {type === "PERSON" ? "Person" : "Company"}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950">Basic Details</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {form.contactType === "COMPANY" ? (
            <>
              <input className="input-field" placeholder="Company name" value={form.companyName} onChange={(event) => onChange({ ...form, companyName: event.target.value })} required disabled={mutating} />
              <input className="input-field" placeholder="Contact person" value={form.contactPersonName} onChange={(event) => onChange({ ...form, contactPersonName: event.target.value })} disabled={mutating} />
            </>
          ) : (
            <>
              <input className="input-field" placeholder="First name" value={form.firstName} onChange={(event) => onChange({ ...form, firstName: event.target.value })} required disabled={mutating} />
              <input className="input-field" placeholder="Last name" value={form.lastName} onChange={(event) => onChange({ ...form, lastName: event.target.value })} disabled={mutating} />
            </>
          )}
          <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} disabled={mutating} />
          <select className="input-field" value={form.phoneCountryCode} onChange={(event) => onChange({ ...form, phoneCountryCode: event.target.value })} disabled={mutating}>
            {COUNTRIES.map((country) => (
              <option key={`${country.name}-${country.phoneCode}`} value={country.phoneCode}>
                {country.name} ({country.phoneCode})
              </option>
            ))}
          </select>
          <input className="input-field" placeholder="Phone number" value={form.phoneNumber} onChange={(event) => onChange({ ...form, phoneNumber: event.target.value.replace(/[^\d\s-]/g, "") })} disabled={mutating} />
          <select className="input-field" value={form.segment} onChange={(event) => onChange({ ...form, segment: event.target.value })} disabled={mutating}>
            <option>LEAD</option>
            <option>PROSPECT</option>
            <option>CUSTOMER</option>
            <option>VIP</option>
            <option>CHURNED</option>
          </select>
          <label className="block text-sm font-semibold text-slate-700">
            Group
            <select className="input-field mt-1" value={form.groupId} onChange={(event) => onChange({ ...form, groupId: event.target.value })} disabled={mutating}>
              <option value="">All Contacts</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950">Billing Address</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <select className="input-field" value={form.country} onChange={(event) => updateCountry(event.target.value)} disabled={mutating}>
            {COUNTRIES.map((country) => (
              <option key={country.name} value={country.name}>
                {country.name}
              </option>
            ))}
          </select>
          {isIndia(form.country) ? (
            <select className="input-field" value={form.state} onChange={(event) => onChange({ ...form, state: event.target.value })} disabled={mutating}>
              <option value="">State</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          ) : (
            <input className="input-field" placeholder="State / Province" value={form.state} onChange={(event) => onChange({ ...form, state: event.target.value })} disabled={mutating} />
          )}
          <input className="input-field" placeholder="City" value={form.city} onChange={(event) => onChange({ ...form, city: event.target.value })} disabled={mutating} />
          <input className="input-field" placeholder={isIndia(form.country) ? "Pincode" : "Postal Code"} value={form.postalCode || form.pincode} onChange={(event) => onChange({ ...form, postalCode: event.target.value, pincode: event.target.value })} disabled={mutating} />
          <input className="input-field xl:col-span-2" placeholder="Address line 1" value={form.addressLine1} onChange={(event) => onChange({ ...form, addressLine1: event.target.value })} disabled={mutating} />
          <input className="input-field xl:col-span-2" placeholder="Address line 2" value={form.addressLine2} onChange={(event) => onChange({ ...form, addressLine2: event.target.value })} disabled={mutating} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-950">Tax Details</h2>
        {form.contactType === "COMPANY" && isIndia(form.country) ? (
          <input className="input-field" placeholder="GSTIN" value={form.gstin} onChange={(event) => onChange({ ...form, gstin: event.target.value.toUpperCase() })} disabled={mutating} />
        ) : !isIndia(form.country) ? (
          <input className="input-field" placeholder="Tax/VAT ID optional" value={form.taxId} onChange={(event) => onChange({ ...form, taxId: event.target.value })} disabled={mutating} />
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No GSTIN is required for person contacts. Add company billing details if this customer needs GST billing.
          </p>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={mutating}>Cancel</button>
        <button className="btn-primary" disabled={mutating}>
          {mutating ? "Saving..." : editingId ? "Update contact" : "Save contact"}
        </button>
      </div>
    </form>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [form, setForm] = useState<ContactFormState>(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("ALL");
  const [groupName, setGroupName] = useState("");
  const [groupEditingId, setGroupEditingId] = useState("");
  const [groupContactIds, setGroupContactIds] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<null | { imported: number; skipped: number; errors: Array<{ row: number; message: string }> }>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const filteredContacts = useMemo(
    () => selectedGroupId === "ALL" ? contacts : contacts.filter((contact) => contact.groupId === selectedGroupId),
    [contacts, selectedGroupId],
  );

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [contactData, groupData] = await Promise.all([
        LeadService.getContacts(),
        LeadService.getContactGroups(),
      ]);
      setContacts(contactData);
      setGroups(groupData);
    } catch {
      setError("Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingId("");
    setFormOpen(false);
  }

  function openCreateContact() {
    setError("");
    setEditingId("");
    setForm({
      ...emptyForm,
      groupId: selectedGroupId === "ALL" ? "" : selectedGroupId,
    });
    setFormOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);
    try {
      if (editingId) {
        await LeadService.updateContact(editingId, form);
      } else {
        await LeadService.createContact(form);
      }
      resetForm();
      await load();
    } catch {
      setError(editingId ? "Could not update contact. Check the billing details and try again." : "Could not create contact. Add a phone number or email and try again.");
    } finally {
      setMutating(false);
    }
  }

  function startEdit(contact: Contact) {
    setError("");
    setEditingId(contact.id);
    setForm(contactToForm(contact));
    setFormOpen(true);
  }

  async function exportCsv() {
    setError("");
    try {
      const blob = await LeadService.downloadExport("contacts");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leadflow-contacts.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not export contacts. Admin or manager access may be required.");
    }
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);
    try {
      let targetGroupId = groupEditingId;
      if (groupEditingId) {
        await LeadService.updateContactGroup(groupEditingId, { name: groupName });
      } else {
        const group = await LeadService.createContactGroup({ name: groupName });
        targetGroupId = group.id;
      }

      await Promise.all(
        contacts.map((contact) => {
          const shouldBeInGroup = groupContactIds.includes(contact.id);

          if (shouldBeInGroup && contact.groupId !== targetGroupId) {
            return LeadService.updateContact(contact.id, {
              ...contactToForm(contact),
              groupId: targetGroupId,
            });
          }

          if (groupEditingId && !shouldBeInGroup && contact.groupId === targetGroupId) {
            return LeadService.updateContact(contact.id, {
              ...contactToForm(contact),
              groupId: "",
            });
          }

          return Promise.resolve();
        }),
      );

      setGroupName("");
      setGroupEditingId("");
      setGroupContactIds([]);
      setGroupModalOpen(false);
      if (targetGroupId) setSelectedGroupId(targetGroupId);
      await load();
    } catch {
      setError("Could not save contact group.");
    } finally {
      setMutating(false);
    }
  }

  async function removeGroup(group: ContactGroup) {
    const confirmed = window.confirm(`Delete contact group "${group.name}"? Contacts in this group will move back to All Contacts.`);
    if (!confirmed) return;

    setError("");
    setMutating(true);
    try {
      await LeadService.deleteContactGroup(group.id);
      if (selectedGroupId === group.id) setSelectedGroupId("ALL");
      if (groupEditingId === group.id) {
        setGroupModalOpen(false);
        setGroupEditingId("");
        setGroupName("");
        setGroupContactIds([]);
      }
      await load();
    } catch {
      setError("Could not delete contact group.");
    } finally {
      setMutating(false);
    }
  }

  async function importCsv() {
    setError("");
    setMutating(true);
    try {
      const result = await LeadService.importContacts(csvText);
      setImportResult(result);
      await load();
    } catch {
      setError("Could not import contacts CSV.");
    } finally {
      setMutating(false);
    }
  }

  function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => setCsvText(text));
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">People</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Contacts</h1>
          <p className="mt-1 text-slate-500">{contacts.length} people ready for follow-up.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <DownloadIcon className="h-4 w-4" />
            Export CSV
          </button>
          <button type="button" onClick={() => { setImportResult(null); setImportModalOpen(true); }} className="btn-secondary">
            <PlusIcon className="h-4 w-4" />
            Import CSV
          </button>
          <button type="button" onClick={openCreateContact} className="btn-primary" disabled={mutating}>
            <PlusIcon className="h-4 w-4" />
            Add Contact
          </button>
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedGroupId("ALL")}
          className={`rounded-full px-3 py-1 text-sm font-semibold ${selectedGroupId === "ALL" ? "bg-[var(--color-primary)] text-white" : "bg-white text-slate-600 shadow-sm"}`}
        >
          All Contacts ({contacts.length})
        </button>
        {groups.map((group) => {
          const selected = selectedGroupId === group.id;
          return (
            <div
              key={group.id}
              className={`flex items-center overflow-hidden rounded-full text-sm font-semibold shadow-sm ${
                selected ? "bg-[var(--color-primary)] text-white" : "bg-white text-slate-600"
              }`}
            >
              <button type="button" onClick={() => setSelectedGroupId(group.id)} className="px-3 py-1">
                {group.name} ({group._count?.contacts ?? 0})
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroupEditingId(group.id);
                  setGroupName(group.name);
                  setGroupContactIds(contacts.filter((contact) => contact.groupId === group.id).map((contact) => contact.id));
                  setGroupModalOpen(true);
                }}
                className={`flex h-7 w-7 items-center justify-center ${selected ? "hover:bg-white/15" : "hover:bg-slate-100"}`}
                title={`Edit ${group.name}`}
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void removeGroup(group)}
                className={`flex h-7 w-7 items-center justify-center ${selected ? "hover:bg-white/15" : "hover:bg-red-50 hover:text-red-600"}`}
                title={`Delete ${group.name}`}
                disabled={mutating}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => { setGroupEditingId(""); setGroupName(""); setGroupContactIds([]); setGroupModalOpen(true); }} className="btn-secondary h-9 px-3">
          <PlusIcon className="h-4 w-4" />
          New Group
        </button>
      </section>

      <section className="mt-6 flex h-[calc(100vh-260px)] min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="z-10 hidden shrink-0 grid-cols-[1.5fr_1fr_0.9fr_0.8fr_1.9fr] gap-4 border-b border-slate-100 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
          <span>Contact</span>
          <span>Phone</span>
          <span>Group</span>
          <span>Segment</span>
          <span>Action</span>
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-6">
          {loading ? (
            <p className="p-8 text-center text-slate-500">Loading contacts...</p>
          ) : filteredContacts.length ? (
            filteredContacts.map((contact) => (
              <article key={contact.id} className="grid gap-2 border-t border-slate-100 px-5 py-3 md:grid-cols-[1.5fr_1fr_0.9fr_0.8fr_1.9fr] md:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{getContactName(contact)}</p>
                  <p className="text-sm text-slate-500">
                    {contact.contactType === "COMPANY" && contact.contactPersonName ? `Contact: ${contact.contactPersonName}` : contact.email || "No email"}
                  </p>
                </div>
                <p className="text-sm text-slate-600">{[contact.phoneCountryCode || "+91", contact.phoneNumber].filter(Boolean).join(" ")}</p>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {contact.group?.name || "All Contacts"}
                </span>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{contact.segment}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => startEdit(contact)} className="btn-secondary h-9 px-3">
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <Link href={`/dashboard/pipeline?contactId=${contact.id}`} className="btn-secondary h-9 px-3">
                    <PlusIcon className="h-4 w-4" />
                    Create Deal
                  </Link>
                  <button type="button" onClick={() => openWhatsApp(contact, `Hello ${contact.firstName},\nYour quotation is ready.`)} className="btn-primary h-9 px-3">
                    <MessageCircleIcon className="h-4 w-4" />
                    Open WhatsApp
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="p-8 text-center text-slate-500">No contacts found in this group.</p>
          )}
        </div>
      </section>

      <Modal
        open={formOpen}
        title={editingId ? "Edit Contact" : "Add Contact"}
        description="Create or update contact billing details without leaving the page."
        onClose={resetForm}
        size="xl"
      >
        <ContactForm
          form={form}
          groups={groups}
          mutating={mutating}
          editingId={editingId}
          error={error}
          onChange={setForm}
          onSubmit={submit}
          onCancel={resetForm}
        />
      </Modal>

      <Modal
        open={groupModalOpen}
        title={groupEditingId ? "Edit Contact Group" : "Create Contact Group"}
        description="Use groups like Hot Leads, VIP Clients, or Follow-up Required."
        onClose={() => {
          setGroupModalOpen(false);
          setGroupEditingId("");
          setGroupName("");
          setGroupContactIds([]);
        }}
        size="md"
      >
        <form onSubmit={saveGroup} className="space-y-4">
          <input className="input-field" placeholder="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} required disabled={mutating} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Add contacts to group</p>
                <p className="mt-1 text-xs text-slate-500">{groupContactIds.length} selected</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => setGroupContactIds(contacts.map((contact) => contact.id))} disabled={mutating}>
                  Select all
                </button>
                <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => setGroupContactIds([])} disabled={mutating}>
                  Clear
                </button>
              </div>
            </div>
            <div className="no-scrollbar mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {contacts.length ? (
                contacts.map((contact) => {
                  const checked = groupContactIds.includes(contact.id);
                  return (
                    <label key={contact.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
                        checked={checked}
                        disabled={mutating}
                        onChange={(event) => {
                          setGroupContactIds((current) =>
                            event.target.checked
                              ? Array.from(new Set([...current, contact.id]))
                              : current.filter((id) => id !== contact.id),
                          );
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">{getContactName(contact)}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[contact.phoneCountryCode || "+91", contact.phoneNumber].filter(Boolean).join(" ")}
                          {contact.email ? ` - ${contact.email}` : ""}
                        </span>
                        {contact.group?.name && contact.groupId !== groupEditingId && (
                          <span className="mt-1 block text-xs text-slate-400">Currently in {contact.group.name}</span>
                        )}
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">No contacts available yet.</p>
              )}
            </div>
          </div>
          {groupEditingId && (
            <button
              type="button"
              onClick={() => {
                const group = groups.find((item) => item.id === groupEditingId);
                if (group) void removeGroup(group);
              }}
              className="w-full rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
              disabled={mutating}
            >
              Delete this group
            </button>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setGroupModalOpen(false)} className="btn-secondary" disabled={mutating}>Cancel</button>
            <button className="btn-primary" disabled={mutating}>{mutating ? "Saving..." : groupEditingId ? "Update Group" : "Create Group"}</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={importModalOpen}
        title="Import Contacts CSV"
        description="Upload CSV with columns like firstName, phoneNumber, email, country, segment, and groupName."
        onClose={() => setImportModalOpen(false)}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Expected columns: `firstName`, `lastName`, `companyName`, `contactPersonName`, `contactType`, `phoneCountryCode`, `phoneNumber`, `email`, `country`, `state`, `city`, `postalCode`, `addressLine1`, `addressLine2`, `gstin`, `taxId`, `segment`, `groupName`
          </div>
          <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="block w-full text-sm" />
          <textarea className="input-field min-h-40" placeholder="Paste CSV text here if you prefer..." value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          {csvText && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                {parseCsvPreview(csvText).map((row, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2 md:grid-cols-4">
                    {row.map((cell, cellIndex) => (
                      <span key={cellIndex} className="truncate">{cell}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {importResult && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="font-semibold text-slate-900">Import Result</p>
              <p className="mt-1 text-slate-600">Imported: {importResult.imported} | Skipped: {importResult.skipped}</p>
              {importResult.errors.length > 0 && (
                <div className="mt-3 space-y-1 text-red-600">
                  {importResult.errors.map((item) => (
                    <p key={`${item.row}-${item.message}`}>Row {item.row}: {item.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setImportModalOpen(false)} className="btn-secondary" disabled={mutating}>Close</button>
            <button type="button" onClick={importCsv} className="btn-primary" disabled={mutating || !csvText.trim()}>
              {mutating ? "Importing..." : "Import Contacts"}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
