"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LeadService } from "@/services";
import type { ActivityLog, ClientOnboardingPanel, DealWorkspace, Note } from "@/types";
import { openWhatsApp } from "@/utils";

type Tab = "Timeline" | "Tasks" | "Quotations" | "Notes" | "Client Onboarding";

const tabs: Tab[] = ["Timeline", "Tasks", "Quotations", "Notes", "Client Onboarding"];

const activityStyles: Record<string, { label: string; icon: string; className: string }> = {
  DEAL_CREATED: { label: "Deal Created", icon: "DC", className: "bg-emerald-50 text-emerald-700" },
  DEAL_STAGE_CHANGED: { label: "Stage Changed", icon: "SC", className: "bg-indigo-50 text-indigo-700" },
  TASK_CREATED: { label: "Task Created", icon: "TC", className: "bg-blue-50 text-blue-700" },
  TASK_COMPLETED: { label: "Task Completed", icon: "TD", className: "bg-emerald-50 text-emerald-700" },
  QUOTATION_CREATED: { label: "Quotation Generated", icon: "QC", className: "bg-amber-50 text-amber-700" },
  QUOTATION_SENT: { label: "Quotation Sent", icon: "QS", className: "bg-purple-50 text-purple-700" },
  NOTE_CREATED: { label: "Note Added", icon: "NA", className: "bg-slate-100 text-slate-700" },
  CLIENT_ONBOARDING_LINK_CREATED: { label: "Onboarding Link Created", icon: "OL", className: "bg-cyan-50 text-cyan-700" },
  CLIENT_ONBOARDING_SENT: { label: "Onboarding Sent", icon: "OS", className: "bg-blue-50 text-blue-700" },
  CLIENT_ONBOARDING_SUBMITTED: { label: "Onboarding Submitted", icon: "OS", className: "bg-emerald-50 text-emerald-700" },
  CLIENT_ONBOARDING_REVIEW_STARTED: { label: "Onboarding Review Started", icon: "OR", className: "bg-amber-50 text-amber-700" },
  CLIENT_ONBOARDING_COMPLETED: { label: "Onboarding Completed", icon: "OC", className: "bg-emerald-50 text-emerald-700" },
  CLIENT_ONBOARDING_LINK_REGENERATED: { label: "Onboarding Link Regenerated", icon: "LR", className: "bg-purple-50 text-purple-700" },
};

function formatMoney(value: number | string, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value?: string) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authorName(note: Note) {
  return note.createdBy ? `${note.createdBy.firstName} ${note.createdBy.lastName}`.trim() : "Team member";
}

function timelineDetails(activity: ActivityLog) {
  const metadata = activity.metadata || {};

  if (activity.eventType === "DEAL_STAGE_CHANGED") {
    const from = typeof metadata.from === "string" ? metadata.from : "Previous";
    const to = typeof metadata.to === "string" ? metadata.to : "Current";
    return `${from} -> ${to}`;
  }

  if (activity.eventType === "QUOTATION_CREATED" || activity.eventType === "QUOTATION_SENT") {
    return typeof metadata.quoteNumber === "string" ? metadata.quoteNumber : "";
  }

  if (activity.eventType === "TASK_CREATED" || activity.eventType === "TASK_COMPLETED") {
    return typeof metadata.title === "string" ? metadata.title : "";
  }

  return "";
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function OnboardingPanel({
  onboarding,
  mutating,
  onStart,
  onRegenerate,
  onMarkSent,
  onUnderReview,
  onComplete,
}: {
  onboarding?: ClientOnboardingPanel | null;
  mutating: boolean;
  onStart: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onMarkSent: () => Promise<void>;
  onUnderReview: () => Promise<void>;
  onComplete: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const linkUrl = onboarding?.latestLink?.url || "";

  async function copyLink() {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!onboarding?.isCode2CrestTenant) {
    return <EmptyState title="Client onboarding is not enabled" body="This Code2Crest-specific workflow is hidden for other LeadFlow tenants." />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article className="rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Client Onboarding</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">{onboarding.template?.name || "Code2Crest Client Onboarding"}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Launch a secure public onboarding form for WON Code2Crest deals. The link is tied to this contact and deal server-side.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{onboarding.status}</span>
        </div>

        {!onboarding.eligible && (
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{onboarding.reason || "Deal must be WON before onboarding can start."}</p>
        )}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-400">Template</dt>
            <dd className="mt-1 font-semibold text-slate-900">{onboarding.template?.status || "Not bootstrapped"}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-400">Submission</dt>
            <dd className="mt-1 font-semibold text-slate-900">{onboarding.latestSubmission?.status || "Not submitted"}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-400">Link Created</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatDate(onboarding.latestLink?.createdAt)}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-400">Expiry</dt>
            <dd className="mt-1 font-semibold text-slate-900">{formatDate(onboarding.latestLink?.expiresAt || undefined)}</dd>
          </div>
        </dl>

        {linkUrl ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase text-slate-400">Public link</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input className="input-field flex-1 bg-white" value={linkUrl} readOnly />
              <button type="button" className="btn-secondary" onClick={copyLink} disabled={mutating}>
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ) : onboarding.latestLink ? (
          <p className="mt-6 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            This secure link was created earlier. Regenerate it to get a fresh copyable URL.
          </p>
        ) : null}
      </article>

      <aside className="rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-950">Actions</h3>
        <div className="mt-4 grid gap-3">
          <button type="button" className="btn-primary justify-center" onClick={onStart} disabled={mutating || !onboarding.eligible || Boolean(onboarding.latestLink)}>
            Start Client Onboarding
          </button>
          <button
            type="button"
            className="btn-secondary justify-center"
            onClick={onRegenerate}
            disabled={mutating || !onboarding.latestLink}
          >
            Regenerate link
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onMarkSent} disabled={mutating || !onboarding.latestLink}>
            Mark Sent
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onUnderReview} disabled={mutating || !onboarding.latestSubmission}>
            Mark Under Review
          </button>
          <button type="button" className="btn-primary justify-center" onClick={onComplete} disabled={mutating || !onboarding.latestSubmission}>
            Mark Completed
          </button>
          {onboarding.latestSubmission && onboarding.template && (
            <Link href={`/dashboard/forms/${onboarding.template.id}/submissions`} className="btn-secondary justify-center text-center">
              View submission
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function DealDetailsPage({ params }: { params: { id: string } }) {
  const [workspace, setWorkspace] = useState<DealWorkspace | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Timeline");
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [editingContent, setEditingContent] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = (await LeadService.getDeal(params.id)) as DealWorkspace;
      setWorkspace(data);
    } catch {
      setError("Could not load this deal workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const leadSource = useMemo(() => {
    if (!workspace) return "Manual";
    return workspace.deal.source || workspace.contact.source || (workspace.contact.metaLeadId ? "Meta Lead" : "Manual");
  }, [workspace]);

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!noteContent.trim()) return;

    setMutating(true);
    setError("");
    try {
      await LeadService.createNote({ dealId: params.id, content: noteContent.trim() });
      setNoteContent("");
      await load();
    } catch {
      setError("Could not create note.");
    } finally {
      setMutating(false);
    }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!editingNoteId || !editingContent.trim()) return;

    setMutating(true);
    setError("");
    try {
      await LeadService.updateNote(editingNoteId, { content: editingContent.trim() });
      setEditingNoteId("");
      setEditingContent("");
      await load();
    } catch {
      setError("Could not update note.");
    } finally {
      setMutating(false);
    }
  }

  async function removeNote(id: string) {
    if (!window.confirm("Delete this note permanently?")) return;

    setMutating(true);
    setError("");
    try {
      await LeadService.deleteNote(id);
      if (editingNoteId === id) {
        setEditingNoteId("");
        setEditingContent("");
      }
      await load();
    } catch {
      setError("Could not delete note.");
    } finally {
      setMutating(false);
    }
  }

  async function runOnboardingAction(action: () => Promise<unknown>, failureMessage: string, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setMutating(true);
    setError("");
    try {
      const panel = (await action()) as ClientOnboardingPanel;
      setWorkspace((current) => (current ? { ...current, onboarding: panel, deal: { ...current.deal, onboardingStatus: panel.status } } : current));
    } catch {
      setError(failureMessage);
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 lg:p-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
        <div className="mt-6 h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="min-h-screen p-5 lg:p-10">
        <EmptyState title="Deal not found" body={error || "This deal may have been removed or you may not have access."} />
      </main>
    );
  }

  const { deal, contact, tasks, quotations, activities, notes } = workspace;

  return (
    <main className="min-h-screen bg-slate-100 p-5 lg:p-10">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/dashboard/pipeline" className="text-sm font-semibold text-emerald-700">
            Back to pipeline
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{deal.title}</h1>
          <p className="mt-1 text-slate-500">Central CRM workspace for customer, deal activity, and next actions.</p>
        </div>
        <span className="w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          {deal.stage}
        </span>
      </header>

      {error && <p className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Customer</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {contact.firstName} {contact.lastName || ""}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openWhatsApp(contact, `Hello ${contact.firstName}, following up on ${deal.title}.`)}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              WhatsApp
            </button>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Phone</dt>
              <dd className="mt-1 font-medium text-slate-800">{contact.phoneNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Email</dt>
              <dd className="mt-1 font-medium text-slate-800">{contact.email || "Not available"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Lead Source</dt>
              <dd className="mt-1 font-medium capitalize text-slate-800">{leadSource.replace(/_/g, " ").toLowerCase()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Status</dt>
              <dd className="mt-1 font-medium text-slate-800">{contact.status}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Deal</p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Deal Title</dt>
              <dd className="mt-1 font-medium text-slate-800">{deal.title}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Deal Value</dt>
              <dd className="mt-1 text-xl font-bold text-slate-950">{formatMoney(deal.value, deal.currency || "INR")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Current Stage</dt>
              <dd className="mt-1 font-medium text-slate-800">{deal.stage}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Probability</dt>
              <dd className="mt-1 font-medium text-slate-800">{deal.probability}%</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Created Date</dt>
              <dd className="mt-1 font-medium text-slate-800">{formatDate(deal.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-400">Last Updated</dt>
              <dd className="mt-1 font-medium text-slate-800">{formatDate(deal.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5 lg:p-6">
          {activeTab === "Timeline" && (
            <div className="space-y-4">
              {activities.length ? (
                activities.map((activity) => {
                  const style = activityStyles[activity.eventType] || {
                    label: activity.eventType,
                    icon: "EV",
                    className: "bg-slate-100 text-slate-700",
                  };
                  const details = timelineDetails(activity);

                  return (
                    <article key={activity.id} className="flex gap-4 rounded-2xl border border-slate-100 p-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.className}`}>
                        {style.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-slate-950">{style.label}</h3>
                          <time className="text-sm text-slate-500">{formatTime(activity.createdAt)}</time>
                        </div>
                        {details && <p className="mt-1 text-sm text-slate-500">{details}</p>}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState title="No timeline activity yet" body="New deal, note, task, and quotation events will appear here." />
              )}
            </div>
          )}

          {activeTab === "Tasks" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {tasks.length ? (
                tasks.map((task) => (
                  <article key={task.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-950">{task.title}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{task.status}</span>
                    </div>
                    {task.description && <p className="mt-2 text-sm text-slate-500">{task.description}</p>}
                    <p className="mt-3 text-sm text-slate-600">Due {new Date(task.dueDate).toLocaleString("en-IN")}</p>
                  </article>
                ))
              ) : (
                <EmptyState title="No tasks for this deal" body="Create a follow-up task from the Tasks module and link it to this deal." />
              )}
            </div>
          )}

          {activeTab === "Quotations" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {quotations.length ? (
                quotations.map((quotation) => (
                  <article key={quotation.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-950">{quotation.quoteNumber}</h3>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(quotation.createdAt)}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{quotation.status}</span>
                    </div>
                    <p className="mt-4 text-xl font-bold text-slate-950">{formatMoney(quotation.total)}</p>
                    <p className="mt-1 text-sm text-slate-500">{quotation.items.length} line items</p>
                  </article>
                ))
              ) : (
                <EmptyState title="No quotations yet" body="Quotations linked to this deal will be listed here newest first." />
              )}
            </div>
          )}

          {activeTab === "Notes" && (
            <div className="space-y-5">
              <form onSubmit={submitNote} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label htmlFor="note" className="text-sm font-semibold text-slate-800">
                  Add Note
                </label>
                <textarea
                  id="note"
                  className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Customer requested eCommerce proposal."
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  disabled={mutating}
                />
                <button type="submit" className="mt-3 btn-primary" disabled={mutating || !noteContent.trim()}>
                  {mutating ? "Saving..." : "Create Note"}
                </button>
              </form>

              <div className="space-y-3">
                {notes.length ? (
                  notes.map((note) => (
                    <article key={note.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                      {editingNoteId === note.id ? (
                        <form onSubmit={saveNote} className="space-y-3">
                          <textarea
                            className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                            value={editingContent}
                            onChange={(event) => setEditingContent(event.target.value)}
                            disabled={mutating}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button type="submit" className="btn-primary" disabled={mutating || !editingContent.trim()}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                              onClick={() => {
                                setEditingNoteId("");
                                setEditingContent("");
                              }}
                              disabled={mutating}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-slate-800">{note.content}</p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{authorName(note)}</p>
                              <p className="text-sm text-slate-500">{formatDate(note.createdAt)}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingContent(note.content);
                                }}
                                disabled={mutating}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                                onClick={() => removeNote(note.id)}
                                disabled={mutating}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </article>
                  ))
                ) : (
                  <EmptyState title="No notes yet" body="Add the first note to capture customer requests, decisions, and context." />
                )}
              </div>
            </div>
          )}

          {activeTab === "Client Onboarding" && (
            <OnboardingPanel
              onboarding={workspace.onboarding}
              mutating={mutating}
              onStart={() => runOnboardingAction(() => LeadService.startClientOnboarding(params.id), "Could not start client onboarding.")}
              onRegenerate={() =>
                runOnboardingAction(
                  () => LeadService.regenerateClientOnboarding(params.id),
                  "Could not regenerate onboarding link.",
                  "Regenerate the onboarding link? The previous active link will be invalidated.",
                )
              }
              onMarkSent={() => runOnboardingAction(() => LeadService.markClientOnboardingSent(params.id), "Could not mark onboarding as sent.")}
              onUnderReview={() =>
                runOnboardingAction(() => LeadService.markClientOnboardingUnderReview(params.id), "Could not mark onboarding under review.")
              }
              onComplete={() => runOnboardingAction(() => LeadService.markClientOnboardingCompleted(params.id), "Could not complete onboarding.")}
            />
          )}
        </div>
      </section>
    </main>
  );
}
