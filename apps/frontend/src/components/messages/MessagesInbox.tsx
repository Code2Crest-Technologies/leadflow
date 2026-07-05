"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ChatWindow from "@/components/messages/ChatWindow";
import { MESSAGE_PLATFORMS, getMessagePlatform, type MessagePlatform } from "@/components/messages/messagePlatform";
import { LeadService, MessageService } from "@/services";
import { useAuthStore } from "@/store";
import type { Contact, Conversation, Deal, Note, User } from "@/types";
import { FileTextIcon, MessageSquareIcon, PlusIcon, ReceiptIcon } from "@/components/ui/Icons";

type InboxFilter = "ALL" | "MY" | "UNASSIGNED" | "CLOSED";
type RightTab = "INFO" | "NOTES" | "ACTIONS";

function contactName(contact?: Contact) {
  if (!contact) return "Customer";
  if (contact.contactType === "COMPANY") return contact.companyName || contact.contactPersonName || contact.firstName;
  return `${contact.firstName} ${contact.lastName || ""}`.trim();
}

function userName(user?: Pick<User, "firstName" | "lastName"> | null) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Unassigned";
}

export default function MessagesInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [assignees, setAssignees] = useState<Array<Pick<User, "id" | "firstName" | "lastName" | "email" | "role">>>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [contactId, setContactId] = useState("");
  const [startChannel, setStartChannel] = useState<MessagePlatform>("MANUAL");
  const [contactSearch, setContactSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const [rightTab, setRightTab] = useState<RightTab>("INFO");
  const [noteDraft, setNoteDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const user = useAuthStore((state) => state.user);
  const canAssign = user?.role === "ADMIN" || user?.role === "MANAGER";

  const load = useCallback(async () => {
    setError("");
    setIsLoading(true);
    try {
      const [conversationData, contactData, dealData, assigneeData] = await Promise.all([
        MessageService.getConversations(),
        LeadService.getContacts(),
        LeadService.getDeals(),
        canAssign ? MessageService.getAssignees().catch(() => []) : Promise.resolve([]),
      ]);
      setConversations(conversationData);
      setContacts(contactData);
      setDeals(dealData);
      setAssignees(assigneeData);
      setSelected((current) =>
        current ? conversationData.find((conversation: Conversation) => conversation.id === current.id) || current : conversationData[0] || null,
      );
    } catch {
      setError("Could not load conversations.");
    } finally {
      setIsLoading(false);
    }
  }, [canAssign]);

  const loadNotes = useCallback(async (conversationId: string) => {
    try {
      setNotes((await MessageService.getConversationNotes(conversationId)) as Note[]);
    } catch {
      setNotes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) void loadNotes(selected.id);
    else setNotes([]);
  }, [loadNotes, selected]);

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      [contactName(contact), contact.companyName || "", contact.phoneNumber, contact.email || ""].join(" ").toLowerCase().includes(query),
    );
  }, [contactSearch, contacts]);

  const selectedDeals = useMemo(
    () => (selected ? deals.filter((deal) => deal.contactId === selected.contactId) : []),
    [deals, selected],
  );

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const lastMessage = conversation.messages?.[0]?.content || "";
      const platform = getMessagePlatform(conversation.channel);
      const matchesQuery =
        !query ||
        [contactName(conversation.contact), conversation.contact.phoneNumber, platform.label, lastMessage]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "MY" && conversation.assignedToId === user?.id) ||
        (filter === "UNASSIGNED" && !conversation.assignedToId) ||
        (filter === "CLOSED" && conversation.status === "CLOSED");
      return matchesQuery && matchesFilter;
    });
  }, [conversationSearch, conversations, filter, user?.id]);

  const selectedContact = contacts.find((contact) => contact.id === contactId);

  function contactLabel(contact: Contact) {
    const detail = [contact.phoneNumber, contact.email].filter(Boolean).join(" - ");
    return detail ? `${contactName(contact)} - ${detail}` : contactName(contact);
  }

  function chooseContact(contact: Contact) {
    setContactId(contact.id);
    setContactSearch(contactLabel(contact));
    setIsContactPickerOpen(false);
  }

  async function startConversation() {
    if (!contactId) return;
    setError("");
    setMutating(true);
    try {
      const conversation = await MessageService.createConversation(contactId, startChannel);
      setContactId("");
      setContactSearch("");
      setStartChannel("MANUAL");
      setIsContactPickerOpen(false);
      await load();
      setSelected(conversation);
    } catch {
      setError("Could not start conversation.");
    } finally {
      setMutating(false);
    }
  }

  async function assignConversation(assignedToId: string) {
    if (!selected) return;
    setError("");
    setMutating(true);
    try {
      const updated = await MessageService.assignConversation(selected.id, assignedToId || null);
      setSelected(updated);
      await load();
    } catch {
      setError("Could not assign conversation.");
    } finally {
      setMutating(false);
    }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!selected || !noteDraft.trim()) return;
    setError("");
    setMutating(true);
    try {
      if (editingNoteId) await MessageService.updateConversationNote(editingNoteId, noteDraft);
      else await MessageService.createConversationNote(selected.id, noteDraft);
      setNoteDraft("");
      setEditingNoteId("");
      await loadNotes(selected.id);
    } catch {
      setError("Could not save note.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!selected) return;
    setMutating(true);
    try {
      await MessageService.deleteConversationNote(noteId);
      await loadNotes(selected.id);
    } catch {
      setError("Could not delete note.");
    } finally {
      setMutating(false);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1440px] min-h-0 flex-col overflow-hidden px-3 py-4 sm:px-5 lg:h-screen lg:px-6 lg:py-6">
      <header className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Unified Inbox</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Messages</h1>
          <p className="mt-1 text-slate-500">Assign conversations, capture notes, and move chats into sales work.</p>
        </div>
        <div className="grid w-full gap-2 md:w-auto md:grid-cols-[minmax(14rem,20rem)_12rem_auto]">
          <div className="relative">
            <input
              className="input-field w-full"
              placeholder="Search or choose contact..."
              value={contactSearch}
              onBlur={() => window.setTimeout(() => setIsContactPickerOpen(false), 120)}
              onChange={(event) => {
                setContactSearch(event.target.value);
                setContactId("");
                setIsContactPickerOpen(true);
              }}
              onFocus={() => setIsContactPickerOpen(true)}
            />
            {isContactPickerOpen && (
              <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg">
                {filteredContacts.length ? (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseContact(contact);
                      }}
                      className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${selectedContact?.id === contact.id ? "bg-emerald-50" : ""}`}
                    >
                      <span className="block font-semibold text-slate-900">{contactName(contact)}</span>
                      <span className="block truncate text-xs text-slate-500">{[contact.phoneNumber, contact.email].filter(Boolean).join(" - ")}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-slate-500">No contacts found.</p>
                )}
              </div>
            )}
          </div>
          <select
            className="input-field"
            value={startChannel}
            onChange={(event) => setStartChannel(event.target.value as MessagePlatform)}
            disabled={mutating}
            title="Message platform"
          >
            {MESSAGE_PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary whitespace-nowrap" onClick={startConversation} disabled={mutating || !contactId}>
            <MessageSquareIcon className="h-4 w-4" />
            Start chat
          </button>
        </div>
      </header>

      {error && <p className="mb-4 shrink-0 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm md:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_340px]">
        <aside className="h-60 min-h-0 overflow-hidden border-b border-[var(--color-border)] md:h-auto md:border-b-0 md:border-r">
          <div className="border-b border-[var(--color-border)] p-4">
            <h2 className="font-bold text-slate-900">Conversations</h2>
            <input className="input-field mt-3" placeholder="Search inbox..." value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} />
            <div className="mt-3 flex flex-wrap gap-2">
              {(["ALL", "MY", "UNASSIGNED", "CLOSED"] as InboxFilter[]).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === item ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600"}`}>
                  {item === "MY" ? "My Chats" : item}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[calc(100%-142px)] overflow-y-auto">
            {isLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading conversations...</p>
            ) : filteredConversations.length ? (
              filteredConversations.map((conversation) => {
                const lastMessage = conversation.messages?.[0];
                const isSelected = selected?.id === conversation.id;
                const platform = getMessagePlatform(conversation.channel);
                return (
                  <button key={conversation.id} type="button" onClick={() => setSelected(conversation)} className={`w-full border-b border-slate-100 p-4 text-left transition ${isSelected ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{contactName(conversation.contact)}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${platform.className}`}>
                        {platform.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{conversation.contact.phoneNumber}</p>
                    <p className="mt-2 truncate text-sm text-slate-600">{lastMessage?.content || "No messages yet"}</p>
                    <p className="mt-2 text-xs text-slate-400">Owner: {userName(conversation.assignedTo)}</p>
                  </button>
                );
              })
            ) : (
              <p className="p-6 text-sm text-slate-500">No conversations match this view.</p>
            )}
          </div>
        </aside>

        <div className="min-h-0 overflow-hidden bg-slate-50 p-4">
          {selected && user ? <ChatWindow key={selected.id} conversation={selected} currentUserId={user.id} /> : <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl bg-white text-slate-500">Select a conversation to start messaging.</div>}
        </div>

        <aside className="hidden min-h-0 overflow-hidden border-t border-[var(--color-border)] bg-white xl:block xl:border-l xl:border-t-0">
          {selected ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-[var(--color-border)] p-4">
                <h2 className="font-bold text-slate-900">{contactName(selected.contact)}</h2>
                <p className="text-sm text-slate-500">{selected.contact.phoneNumber}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <p className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Assigned: {userName(selected.assignedTo)}</p>
                  <p className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${getMessagePlatform(selected.channel).className}`}>
                    {getMessagePlatform(selected.channel).label}
                  </p>
                </div>
                {canAssign && (
                  <label className="mt-3 block text-sm font-semibold text-slate-700">
                    Assign
                    <select className="input-field mt-1" value={selected.assignedToId || ""} onChange={(event) => assignConversation(event.target.value)} disabled={mutating}>
                      <option value="">Unassigned</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>{userName(assignee)} ({assignee.role === "AGENT" ? "SALES" : assignee.role})</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="flex border-b border-[var(--color-border)]">
                {(["INFO", "NOTES", "ACTIONS"] as RightTab[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => setRightTab(tab)} className={`flex-1 px-3 py-3 text-sm font-semibold ${rightTab === tab ? "bg-slate-50 text-[var(--color-primary)]" : "text-slate-500"}`}>
                    {tab === "INFO" ? "Customer" : tab}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {rightTab === "INFO" && (
                  <div className="space-y-3 text-sm text-slate-600">
                    <p><strong>Email:</strong> {selected.contact.email || "Not added"}</p>
                    <p><strong>Segment:</strong> {selected.contact.segment}</p>
                    <p><strong>Status:</strong> {selected.status}</p>
                    <p><strong>Linked deals:</strong> {selectedDeals.length}</p>
                    {selectedDeals.map((deal) => <Link key={deal.id} href={`/dashboard/deals/${deal.id}`} className="block rounded-xl border border-slate-200 p-3 font-semibold text-slate-900 hover:bg-slate-50">{deal.title}</Link>)}
                  </div>
                )}
                {rightTab === "ACTIONS" && (
                  <div className="grid gap-2">
                    <Link className="btn-primary text-center" href={`/dashboard/pipeline?contactId=${selected.contactId}&openForm=1`}><PlusIcon className="h-4 w-4" />Create Deal</Link>
                    <Link className="btn-secondary text-center" href="/dashboard/tasks"><PlusIcon className="h-4 w-4" />Create Task</Link>
                    <Link className="btn-secondary text-center" href="/dashboard/quotations"><FileTextIcon className="h-4 w-4" />Create Quotation</Link>
                    <Link className="btn-secondary text-center" href="/dashboard/invoices"><ReceiptIcon className="h-4 w-4" />Create Invoice</Link>
                    <button type="button" onClick={() => setRightTab("NOTES")} className="btn-secondary"><PlusIcon className="h-4 w-4" />Add Note</button>
                  </div>
                )}
                {rightTab === "NOTES" && (
                  <div className="space-y-4">
                    <form onSubmit={saveNote} className="space-y-2">
                      <textarea className="input-field min-h-24" placeholder="Customer requirement, manager instruction, or sales follow-up detail..." value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} disabled={mutating} />
                      <div className="flex justify-end gap-2">
                        {editingNoteId && <button type="button" className="btn-secondary" onClick={() => { setEditingNoteId(""); setNoteDraft(""); }}>Cancel</button>}
                        <button className="btn-primary" disabled={mutating || !noteDraft.trim()}>{editingNoteId ? "Update note" : "Add note"}</button>
                      </div>
                    </form>
                    {notes.length ? notes.map((note) => (
                      <article key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <p className="whitespace-pre-wrap text-slate-700">{note.content}</p>
                        <p className="mt-2 text-xs text-slate-400">{note.createdBy ? `${note.createdBy.firstName} ${note.createdBy.lastName}` : "Team"} - {new Date(note.createdAt).toLocaleString("en-IN")}</p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => { setEditingNoteId(note.id); setNoteDraft(note.content); }}>Edit</button>
                          <button type="button" className="text-xs font-semibold text-red-600" onClick={() => deleteNote(note.id)}>Delete</button>
                        </div>
                      </article>
                    )) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No internal notes yet.</p>}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-500">Select a conversation to view customer details.</div>
          )}
        </aside>
      </section>
    </main>
  );
}
