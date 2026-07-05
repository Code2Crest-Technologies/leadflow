"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LeadService } from "@/services";
import type { Contact, Deal, Task } from "@/types";
import Modal from "@/components/shared/Modal";
import { CheckCircleIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";

const emptyForm = {
  title: "",
  description: "",
  contactId: "",
  dealId: "",
  dueDate: "",
  status: "PENDING",
};

type TaskForm = typeof emptyForm;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDueDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toInputDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formToPayload(form: TaskForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    contactId: form.contactId || "",
    dealId: form.dealId || "",
    dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : form.dueDate,
    status: form.status,
  };
}

function taskToForm(task: Task): TaskForm {
  return {
    title: task.title,
    description: task.description || "",
    contactId: task.contactId || "",
    dealId: task.dealId || "",
    dueDate: toInputDateTime(task.dueDate),
    status: task.status || "PENDING",
  };
}

function TaskFormFields({
  form,
  contacts,
  deals,
  submitLabel,
  onSubmit,
  onChange,
  onCancel,
  compact = false,
  disabled = false,
}: {
  form: TaskForm;
  contacts: Contact[];
  deals: Deal[];
  submitLabel: string;
  onSubmit: (event: FormEvent) => void;
  onChange: (form: TaskForm) => void;
  onCancel?: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const gridClass = compact
    ? "grid gap-4 md:grid-cols-2"
    : "grid gap-4 md:grid-cols-2 xl:grid-cols-3";
  const [contactSearch, setContactSearch] = useState("");
  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const filteredDeals = form.contactId
    ? deals.filter((deal) => deal.contactId === form.contactId)
    : [];
  const selectedContact = contacts.find((contact) => contact.id === form.contactId);

  function contactName(contact: Contact) {
    return contact.companyName || `${contact.firstName} ${contact.lastName || ""}`.trim();
  }

  function contactLabel(contact: Contact) {
    return [contactName(contact), contact.phoneNumber, contact.email].filter(Boolean).join(" - ");
  }

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query || selectedContact?.id === form.contactId) return contacts;
    return contacts.filter((contact) =>
      [contactName(contact), contact.phoneNumber, contact.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [contactSearch, contacts, selectedContact?.id, form.contactId]);

  useEffect(() => {
    if (!form.contactId) {
      setContactSearch("");
      return;
    }

    const contact = contacts.find((item) => item.id === form.contactId);
    if (contact) setContactSearch(contactLabel(contact));
  }, [contacts, form.contactId]);

  function chooseContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    onChange({ ...form, contactId, dealId: "" });
    setContactSearch(contact ? contactLabel(contact) : "");
    setIsContactPickerOpen(false);
  }

  return (
    <form onSubmit={onSubmit} className={`${compact ? "" : "card mt-4"} grid gap-4 ${gridClass}`}>
      <input
        className="input-field"
        placeholder="Call customer tomorrow"
        value={form.title}
        onChange={(event) => onChange({ ...form, title: event.target.value })}
        required
        disabled={disabled}
      />
      <input
        className="input-field md:col-span-2"
        placeholder="Description"
        value={form.description}
        onChange={(event) => onChange({ ...form, description: event.target.value })}
        disabled={disabled}
      />
      <div className="relative">
        <input
          className="input-field w-full"
          placeholder="Search contact by name, phone, or email..."
          value={contactSearch}
          onBlur={() => window.setTimeout(() => setIsContactPickerOpen(false), 120)}
          onChange={(event) => {
            setContactSearch(event.target.value);
            onChange({ ...form, contactId: "", dealId: "" });
            setIsContactPickerOpen(true);
          }}
          onFocus={() => setIsContactPickerOpen(true)}
          disabled={disabled}
        />
        {isContactPickerOpen && (
          <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white shadow-lg">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                chooseContact("");
              }}
              className={`block w-full px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                !form.contactId ? "bg-emerald-50" : ""
              }`}
            >
              <span className="block font-semibold text-slate-900">No contact</span>
              <span className="block text-xs text-slate-500">Create task without linking a contact</span>
            </button>
            {filteredContacts.length ? (
              filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    chooseContact(contact.id);
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
      <select
        className="input-field"
        value={form.dealId}
        onChange={(event) => onChange({ ...form, dealId: event.target.value })}
        disabled={disabled || !form.contactId}
      >
        <option value="">
          {!form.contactId
            ? "Select contact first"
            : filteredDeals.length
              ? "No deal"
              : "No deals for this contact"}
        </option>
        {filteredDeals.map((deal) => (
          <option key={deal.id} value={deal.id}>
            {deal.title}
          </option>
        ))}
      </select>
      <input
        className="input-field"
        type="datetime-local"
        value={form.dueDate}
        onChange={(event) => onChange({ ...form, dueDate: event.target.value })}
        required
        disabled={disabled}
      />
      <select
        className="input-field"
        value={form.status}
        onChange={(event) => onChange({ ...form, status: event.target.value })}
        disabled={disabled}
      >
        <option value="PENDING">PENDING</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="CANCELLED">CANCELLED</option>
      </select>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="submit" className="btn-primary" disabled={disabled}>
          <CheckCircleIcon className="h-4 w-4" />
          {disabled ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="btn-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function TaskCard({
  task,
  mutating,
  onEdit,
  onStatus,
  onDelete,
}: {
  task: Task;
  mutating: boolean;
  onEdit: (task: Task) => void;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    COMPLETED: "bg-emerald-50 text-emerald-700",
    CANCELLED: "bg-slate-100 text-slate-600",
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{task.title}</h3>
          {task.description && (
            <p className="mt-1 text-sm text-slate-500">{task.description}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${statusColors[task.status] || "bg-slate-100 text-slate-600"}`}
        >
          {task.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">Due {formatDueDate(task.dueDate)}</p>
      {task.contact && (
        <p className="mt-1 text-sm text-slate-500">
          {task.contact.firstName} {task.contact.lastName || ""} - {task.contact.phoneNumber}
        </p>
      )}
      {task.deal && <p className="mt-1 text-sm text-slate-500">Deal: {task.deal.title}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onEdit(task)}
          disabled={mutating}
          className="btn-secondary h-9 px-3"
        >
          <PencilIcon className="h-4 w-4" />
          Edit
        </button>
        {task.status === "PENDING" ? (
          <button
            type="button"
            onClick={() => onStatus(task.id, "COMPLETED")}
            disabled={mutating}
            className="btn-secondary h-9 px-3 text-emerald-700"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Complete
          </button>
        ) : task.status === "COMPLETED" ? (
          <button
            type="button"
            onClick={() => onStatus(task.id, "PENDING")}
            disabled={mutating}
            className="btn-secondary h-9 px-3"
          >
            Reopen
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStatus(task.id, "PENDING")}
            disabled={mutating}
            className="btn-secondary h-9 px-3"
          >
            Restore
          </button>
        )}
        {task.status === "PENDING" && (
          <button
            type="button"
            onClick={() => onStatus(task.id, "CANCELLED")}
            disabled={mutating}
            className="btn-secondary h-9 px-3"
          >
            Cancel task
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          disabled={mutating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-50"
        >
          <TrashIcon className="h-4 w-4" />
          Delete
        </button>
      </div>
    </article>
  );
}

function TaskSection({
  title,
  items,
  color,
  mutating,
  onEdit,
  onStatus,
  onDelete,
  emptyMessage,
}: {
  title: string;
  items: Task[];
  color: string;
  mutating: boolean;
  onEdit: (task: Task) => void;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="flex h-[360px] w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm xl:w-auto">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3">
        <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
        <span className="rounded-full bg-[var(--color-bg)] px-3 py-1 text-sm font-semibold text-slate-500">
          {items.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.length ? (
          items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              mutating={mutating}
              onEdit={onEdit}
              onStatus={onStatus}
              onDelete={onDelete}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-[var(--color-bg)] p-6 text-sm text-slate-500">
            {emptyMessage || "Nothing here right now."}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editForm, setEditForm] = useState<TaskForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [taskData, contactData, dealData] = await Promise.all([
        LeadService.getTasks(),
        LeadService.getContacts(),
        LeadService.getDeals(),
      ]);
      setTasks(taskData);
      setContacts(contactData);
      setDeals(dealData);
    } catch {
      setError("Could not load follow-up tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const buckets = useMemo(() => {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pending = tasks.filter((task) => task.status === "PENDING");
    return {
      overdue: pending.filter((task) => new Date(task.dueDate) < today),
      today: pending.filter((task) => {
        const due = new Date(task.dueDate);
        return due >= today && due < tomorrow;
      }),
      upcoming: pending.filter((task) => new Date(task.dueDate) >= tomorrow),
      completed: tasks.filter((task) => task.status === "COMPLETED"),
      cancelled: tasks.filter((task) => task.status === "CANCELLED"),
    };
  }, [tasks]);

  const startEdit = (task: Task) => {
    setError("");
    setEditingTaskId(task.id);
    setEditForm(taskToForm(task));
  };

  const closeCreateForm = () => {
    setShowForm(false);
    setForm(emptyForm);
  };

  const closeEditForm = () => {
    setEditingTaskId("");
    setEditForm(emptyForm);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMutating(true);

    try {
      await LeadService.createTask(formToPayload(form));
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch {
      setError("Could not create task. Add a title and due date, then try again.");
    } finally {
      setMutating(false);
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingTaskId) return;
    setError("");
    setMutating(true);

    try {
      await LeadService.updateTask(editingTaskId, formToPayload(editForm));
      setEditingTaskId("");
      setEditForm(emptyForm);
      await load();
    } catch {
      setError("Could not update task. Check all fields and try again.");
    } finally {
      setMutating(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setError("");
    setMutating(true);

    try {
      await LeadService.updateTaskStatus(id, status);
      if (editingTaskId === id) {
        setEditingTaskId("");
        setEditForm(emptyForm);
      }
      await load();
    } catch {
      setError("Could not update task status.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteTask(id: string) {
    const confirmed = window.confirm("Delete this task permanently?");
    if (!confirmed) return;

    setError("");
    setMutating(true);

    try {
      await LeadService.deleteTask(id);
      if (editingTaskId === id) {
        setEditingTaskId("");
        setEditForm(emptyForm);
      }
      await load();
    } catch {
      setError("Could not delete task.");
    } finally {
      setMutating(false);
    }
  }

  const activeSections = [
    ["Overdue Tasks", buckets.overdue, "text-red-600"],
    ["Today's Tasks", buckets.today, "text-emerald-700"],
    ["Upcoming Tasks", buckets.upcoming, "text-slate-700"],
  ] as const;

  const sharedSectionProps = {
    mutating,
    onEdit: startEdit,
    onStatus: updateStatus,
    onDelete: deleteTask,
  };

  return (
    <main className="mx-auto flex h-screen max-w-[1440px] min-w-0 flex-col overflow-hidden px-5 py-6 lg:px-6">
      <header className="shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Follow-up Module
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Tasks</h1>
          <p className="mt-1 text-slate-500">
            Calls, quotations, and reminders that move deals forward.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          Create follow-up
        </button>
        </div>
      </header>

      <div className="mt-6 flex shrink-0 flex-wrap gap-3">
        {[
          ["Overdue", buckets.overdue.length, "bg-red-50 text-red-700"],
          ["Today", buckets.today.length, "bg-emerald-50 text-emerald-700"],
          ["Upcoming", buckets.upcoming.length, "bg-slate-100 text-slate-700"],
          ["Completed", buckets.completed.length, "bg-emerald-50 text-emerald-800"],
        ].map(([label, count, style]) => (
          <span
            key={label}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${style}`}
          >
            {label}: {count}
          </span>
        ))}
      </div>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <Modal
        open={showForm}
        title="Create Follow-up"
        description="Schedule a call, reminder, or quotation follow-up and link it to the right contact."
        onClose={closeCreateForm}
        size="lg"
      >
        <TaskFormFields
          form={form}
          contacts={contacts}
          deals={deals}
          submitLabel="Save task"
          onSubmit={submit}
          onChange={setForm}
          onCancel={closeCreateForm}
          compact
          disabled={mutating}
        />
      </Modal>

      <Modal
        open={Boolean(editingTaskId)}
        title="Edit Task"
        description="Update the follow-up details without moving the task board."
        onClose={closeEditForm}
        size="lg"
      >
        <TaskFormFields
          form={editForm}
          contacts={contacts}
          deals={deals}
          submitLabel="Save changes"
          onSubmit={saveEdit}
          onChange={setEditForm}
          onCancel={closeEditForm}
          compact
          disabled={mutating}
        />
      </Modal>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading tasks...</p>
        ) : (
          <>
          <section className="mt-6 overflow-x-auto pb-3">
            <div className="flex min-w-max gap-5 xl:grid xl:min-w-0 xl:grid-cols-3">
            {activeSections.map(([title, items, color]) => (
              <TaskSection
                key={title}
                title={title}
                items={items}
                color={color}
                {...sharedSectionProps}
              />
            ))}
            </div>
          </section>

          <section className="mt-6 grid gap-5 pb-8 xl:grid-cols-2">
            <div className="flex h-[430px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
              <div className="shrink-0 border-b border-[var(--color-border)] bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-emerald-800">Completed Tasks</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                    {buckets.completed.length}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Tasks marked complete appear here. You can reopen or delete them anytime.
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {buckets.completed.length ? (
                  buckets.completed.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    mutating={mutating}
                    onEdit={startEdit}
                    onStatus={updateStatus}
                    onDelete={deleteTask}
                  />
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-sm text-slate-500">
                    No completed tasks yet. Mark a pending task as complete to see it here.
                  </p>
                )}
              </div>
            </div>

            <div className="flex h-[430px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
              <div className="shrink-0 border-b border-[var(--color-border)] bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-600">Cancelled Tasks</h2>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                    {buckets.cancelled.length}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Cancelled follow-ups stay here without stretching the page.
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {buckets.cancelled.length ? (
                  buckets.cancelled.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      mutating={mutating}
                      onEdit={startEdit}
                      onStatus={updateStatus}
                      onDelete={deleteTask}
                    />
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-[var(--color-bg)] p-6 text-sm text-slate-500">
                    No cancelled tasks.
                  </p>
                )}
              </div>
            </div>
          </section>
          </>
        )}
      </div>
    </main>
  );
}
