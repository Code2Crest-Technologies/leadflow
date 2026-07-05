"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import type { Contact } from "@/types";

type ContactSearchSelectProps = {
  contacts: Contact[];
  value?: string;
  onChange: (contactId: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
};

function contactName(contact: Contact) {
  if (contact.contactType === "COMPANY") {
    return contact.companyName || contact.contactPersonName || contact.firstName;
  }
  return `${contact.firstName} ${contact.lastName || ""}`.trim();
}

function contactSearchText(contact: Contact) {
  return [
    contactName(contact),
    contact.companyName,
    contact.contactPersonName,
    contact.phoneNumber,
    contact.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function ContactSearchSelect({
  contacts,
  value,
  onChange,
  disabled = false,
  label = "Customer",
  placeholder = "Search by name, company, phone, or email",
  required = false,
}: ContactSearchSelectProps) {
  const selectedContact = contacts.find((contact) => contact.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts.slice(0, 12);
    return contacts.filter((contact) => contactSearchText(contact).includes(normalized)).slice(0, 12);
  }, [contacts, query]);

  function selectContact(contact: Contact) {
    onChange(contact.id);
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
  }

  function clearContact() {
    onChange("");
    setQuery("");
    setOpen(false);
    setHighlightedIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && ["ArrowDown", "Enter"].includes(event.key)) {
      setOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, filteredContacts.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && filteredContacts[highlightedIndex]) {
      event.preventDefault();
      selectContact(filteredContacts[highlightedIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {selectedContact ? (
        <div className="mt-1 rounded-xl border border-[var(--color-border)] bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-950">{contactName(selectedContact)}</p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {[selectedContact.phoneCountryCode, selectedContact.phoneNumber].filter(Boolean).join(" ")}
              </p>
              {selectedContact.email && (
                <p className="mt-0.5 truncate text-xs text-slate-500">{selectedContact.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearContact}
              disabled={disabled}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-1">
          <input
            className="input-field w-full"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            required={required && !value}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {open && (
            <div className="absolute left-0 right-0 z-40 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg">
              {filteredContacts.length ? (
                filteredContacts.map((contact, index) => (
                  <button
                    key={contact.id}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectContact(contact);
                    }}
                    className={`block w-full px-4 py-3 text-left transition ${
                      highlightedIndex === index ? "bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {contactName(contact)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {[contact.phoneCountryCode, contact.phoneNumber].filter(Boolean).join(" ")}
                      {contact.email ? ` - ${contact.email}` : ""}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">No contacts found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </label>
  );
}
