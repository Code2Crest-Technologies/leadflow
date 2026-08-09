"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LeadService } from "@/services";
import type { ActivityLog, ClientOnboardingPanel, DealWorkspace, DocumentTemplate, KickoffReadiness, LeadFlowDocument, Note, Project } from "@/types";
import { openWhatsApp } from "@/utils";

type Tab = "Timeline" | "Tasks" | "Quotations" | "Notes" | "Client Onboarding" | "Documents" | "Project Kickoff";

const tabs: Tab[] = ["Timeline", "Tasks", "Quotations", "Notes", "Client Onboarding", "Documents", "Project Kickoff"];

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
  CLIENT_ONBOARDING_EMAIL_SENT: { label: "Onboarding Email Sent", icon: "OE", className: "bg-blue-50 text-blue-700" },
  CLIENT_ONBOARDING_WHATSAPP_SHARED: { label: "Onboarding WhatsApp Shared", icon: "OW", className: "bg-emerald-50 text-emerald-700" },
  CLIENT_ONBOARDING_REMINDER_SENT: { label: "Onboarding Reminder Sent", icon: "OR", className: "bg-orange-50 text-orange-700" },
  CLIENT_ONBOARDING_FORM_OPENED: { label: "Client Opened Form", icon: "OF", className: "bg-cyan-50 text-cyan-700" },
  CLIENT_ONBOARDING_SUBMITTED: { label: "Onboarding Submitted", icon: "OS", className: "bg-emerald-50 text-emerald-700" },
  CLIENT_ONBOARDING_REVIEW_STARTED: { label: "Onboarding Review Started", icon: "OR", className: "bg-amber-50 text-amber-700" },
  CLIENT_ONBOARDING_COMPLETED: { label: "Onboarding Completed", icon: "OC", className: "bg-emerald-50 text-emerald-700" },
  CLIENT_ONBOARDING_LINK_REGENERATED: { label: "Onboarding Link Regenerated", icon: "LR", className: "bg-purple-50 text-purple-700" },
  PROJECT_CREATED: { label: "Project Created", icon: "PC", className: "bg-emerald-50 text-emerald-700" },
  PROJECT_MANAGER_ASSIGNED: { label: "Project Manager Assigned", icon: "PM", className: "bg-blue-50 text-blue-700" },
  PROJECT_STARTED: { label: "Project Started", icon: "PS", className: "bg-emerald-50 text-emerald-700" },
  PROJECT_KICKOFF_READINESS_OVERRIDE: { label: "Readiness Override", icon: "RO", className: "bg-amber-50 text-amber-700" },
  DOCUMENT_CREATED: { label: "Document Created", icon: "DC", className: "bg-cyan-50 text-cyan-700" },
  DOCUMENT_MARKED_READY: { label: "Document Ready", icon: "DR", className: "bg-emerald-50 text-emerald-700" },
  DOCUMENT_SENT: { label: "Document Sent", icon: "DS", className: "bg-blue-50 text-blue-700" },
  DOCUMENT_VIEWED: { label: "Document Viewed", icon: "DV", className: "bg-indigo-50 text-indigo-700" },
  DOCUMENT_ACCEPTED: { label: "Document Accepted", icon: "DA", className: "bg-emerald-50 text-emerald-700" },
  DOCUMENT_REJECTED: { label: "Document Rejected", icon: "DX", className: "bg-red-50 text-red-700" },
  DOCUMENT_REVISION_CREATED: { label: "Document Revision", icon: "RV", className: "bg-amber-50 text-amber-700" },
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
  onCopyLink,
  onSendEmail,
  onShareWhatsApp,
  onDownloadPdf,
  onMarkSent,
  onUnderReview,
  onComplete,
}: {
  onboarding?: ClientOnboardingPanel | null;
  mutating: boolean;
  onStart: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onCopyLink: () => Promise<void>;
  onSendEmail: () => Promise<void>;
  onShareWhatsApp: () => Promise<void>;
  onDownloadPdf: () => Promise<void>;
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
          <button type="button" className="btn-secondary justify-center" onClick={onCopyLink} disabled={mutating || !onboarding.eligible}>
            Copy Link
          </button>
          <button type="button" className="btn-primary justify-center" onClick={onSendEmail} disabled={mutating || !onboarding.eligible}>
            Send Client Onboarding
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onShareWhatsApp} disabled={mutating || !onboarding.eligible}>
            Share via WhatsApp
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onUnderReview} disabled={mutating || !onboarding.latestSubmission}>
            Mark Under Review
          </button>
          <button type="button" className="btn-primary justify-center" onClick={onComplete} disabled={mutating || !onboarding.latestSubmission}>
            Mark Completed
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onDownloadPdf} disabled={mutating || !onboarding.latestSubmission}>
            Download Onboarding PDF
          </button>
          <button type="button" className="btn-secondary justify-center" onClick={onMarkSent} disabled={mutating || !onboarding.latestLink}>
            Mark Sent
          </button>
          {onboarding.latestSubmission && onboarding.template && (
            <Link href={`/dashboard/forms/${onboarding.template.id}/submissions`} className="btn-secondary justify-center text-center">
              View all submissions
            </Link>
          )}
        </div>
      </aside>

      {onboarding.latestSubmission?.sections && onboarding.latestSubmission.sections.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Submission Summary</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Client answers grouped by section</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Submitted {formatDate(onboarding.latestSubmission.submittedAt)}
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {onboarding.latestSubmission.sections.map((section) => (
              <details key={section.section} className="rounded-2xl border border-slate-200 bg-slate-50 p-4" open>
                <summary className="cursor-pointer text-base font-bold text-slate-950">{section.section}</summary>
                <div className="mt-4 space-y-3">
                  {section.answers.map((answer) => (
                    <div key={answer.key} className="rounded-xl bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{answer.label}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">{answer.displayValue || "-"}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {onboarding.reminders && onboarding.reminders.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h3 className="font-bold text-slate-950">Reminder history</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {onboarding.reminders.map((reminder) => (
              <span key={reminder.id} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                Day {reminder.reminderDay} · {formatDate(reminder.sentAt)}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectKickoffPanel({
  readiness,
  project,
  mutating,
  onCreate,
}: {
  readiness?: KickoffReadiness | null;
  project?: Project | null;
  mutating: boolean;
  onCreate: (overrideReason?: string) => Promise<void>;
}) {
  const [overrideReason, setOverrideReason] = useState("");
  const checks = readiness?.checks || [];
  const blockers = readiness?.blockers || [];
  const warnings = readiness?.warnings || [];
  const currentProject = project || readiness?.project || null;
  const needsOverride = blockers.length > 0;

  const badgeClass: Record<string, string> = {
    PASSED: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    WARNING: "bg-amber-50 text-amber-700",
    NOT_CONFIGURED: "bg-slate-100 text-slate-600",
  };

  if (currentProject) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Project Created</p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">{currentProject.name}</h3>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase text-slate-400">Status</dt>
              <dd className="mt-1 font-semibold text-slate-900">{currentProject.status}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase text-slate-400">Project Manager</dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {currentProject.projectManager
                  ? `${currentProject.projectManager.firstName} ${currentProject.projectManager.lastName}`
                  : "Not assigned"}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase text-slate-400">Start Date</dt>
              <dd className="mt-1 font-semibold text-slate-900">{formatDate(currentProject.startDate || undefined)}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase text-slate-400">Target Date</dt>
              <dd className="mt-1 font-semibold text-slate-900">{formatDate(currentProject.targetDate || undefined)}</dd>
            </div>
          </dl>
        </article>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-bold text-slate-950">Handoff</h3>
          <p className="mt-2 text-sm text-slate-500">Project brief, team, milestones, tasks, requirements, and commercial readiness are available in the project workspace.</p>
          <Link href={`/dashboard/projects/${currentProject.id}`} className="btn-primary mt-5 justify-center text-center">
            Open Project
          </Link>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <article className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Kickoff Readiness</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">{readiness?.ready ? "Ready to create project" : "Resolve blockers before kickoff"}</h3>
        <div className="mt-5 grid gap-3">
          {checks.map((check) => (
            <div key={check.key} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-950">{check.label}</p>
                <p className="mt-1 text-sm text-slate-500">{check.message}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${badgeClass[check.status] || badgeClass.NOT_CONFIGURED}`}>{check.status}</span>
            </div>
          ))}
        </div>
      </article>

      <aside className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-950">Create Project</h3>
        {blockers.length > 0 && (
          <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <p className="font-bold">Blocking items</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-bold">Visible warnings</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        {needsOverride && (
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Admin override reason
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Explain why this project should be created before all blockers are resolved."
            />
          </label>
        )}
        <button
          type="button"
          className="btn-primary mt-5 w-full justify-center"
          disabled={mutating || (!readiness?.ready && overrideReason.trim().length < 8)}
          onClick={() => onCreate(needsOverride ? overrideReason.trim() : undefined)}
        >
          {mutating ? "Creating..." : "Create Project"}
        </button>
      </aside>
    </div>
  );
}

function DocumentsPanel({
  dealId,
  projectId,
  documents,
  mutating,
  onReload,
  onError,
}: {
  dealId: string;
  projectId?: string | null;
  documents: LeadFlowDocument[];
  mutating: boolean;
  onReload: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [type, setType] = useState("PROPOSAL");
  const [templateId, setTemplateId] = useState("");
  const [copiedLink, setCopiedLink] = useState("");

  useEffect(() => {
    LeadService.getDocumentTemplates()
      .then((data) => {
        setTemplates(data);
        const first = data.find((template: DocumentTemplate) => template.type === type);
        setTemplateId(first?.id || "");
      })
      .catch(() => onError("Could not load document templates."));
  }, []);

  useEffect(() => {
    const first = templates.find((template) => template.type === type);
    setTemplateId(first?.id || "");
  }, [type, templates]);

  async function run(action: () => Promise<unknown>, errorMessage: string) {
    try {
      await action();
      await onReload();
    } catch {
      onError(errorMessage);
    }
  }

  async function createDoc() {
    await run(
      () => LeadService.createDocument({ dealId, projectId: projectId || undefined, type, templateId: templateId || undefined }),
      "Could not create document.",
    );
  }

  async function copyLink(documentId: string) {
    try {
      const link = await LeadService.createDocumentPublicLink(documentId);
      await navigator.clipboard.writeText(link.url);
      setCopiedLink(documentId);
      window.setTimeout(() => setCopiedLink(""), 1800);
      await onReload();
    } catch {
      onError("Could not create public review link. Mark the document ready first.");
    }
  }

  async function downloadPdf(doc: LeadFlowDocument) {
    try {
      const blob = await LeadService.downloadDocumentPdf(doc.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.title.replace(/[^\w-]+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      onError("Could not download document PDF.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-700">Commercial Documents</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Create client-facing document</h3>
          </div>
          <select className="input-field lg:w-72" value={type} onChange={(event) => setType(event.target.value)}>
            {["PROPOSAL", "STATEMENT_OF_WORK", "SERVICE_AGREEMENT", "NDA", "MAINTENANCE_AGREEMENT", "SAAS_SUBSCRIPTION_AGREEMENT", "CUSTOM"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="input-field lg:w-80" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Default template</option>
            {templates.filter((template) => template.type === type).map((template) => (
              <option key={template.id} value={template.id}>{template.name}{template.isSystemTemplate ? " (system)" : ""}</option>
            ))}
          </select>
          <button type="button" className="btn-primary justify-center" onClick={createDoc} disabled={mutating}>
            Create Document
          </button>
        </div>
      </section>

      {documents.length ? (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{doc.type} · v{doc.currentVersion?.versionNumber || 1}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{doc.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Status {doc.status} · Created {formatDate(doc.createdAt)} · Expires {formatDate(doc.expiresAt || undefined)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{doc.status}</span>
              </div>
              {doc.currentVersion?.renderedContent && (
                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer font-semibold text-slate-800">Preview</summary>
                  <div className="prose prose-sm mt-4 max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: doc.currentVersion.renderedContent }} />
                </details>
              )}
              {doc.acceptances?.[0] && (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Accepted by {doc.acceptances[0].acceptedByName} on {formatDate(doc.acceptances[0].acceptedAt)}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => run(() => LeadService.markDocumentReady(doc.id), "Could not mark document ready.")} disabled={mutating || doc.status === "ACCEPTED"}>
                  Mark Ready
                </button>
                <button type="button" className="btn-secondary" onClick={() => copyLink(doc.id)} disabled={mutating || !["READY", "SENT", "VIEWED"].includes(doc.status)}>
                  {copiedLink === doc.id ? "Copied" : "Copy Link"}
                </button>
                <button type="button" className="btn-primary" onClick={() => run(() => LeadService.sendDocument(doc.id), "Could not send document. Check email configuration and document status.")} disabled={mutating || doc.status !== "READY"}>
                  Send
                </button>
                <button type="button" className="btn-secondary" onClick={() => run(() => LeadService.createDocumentRevision(doc.id), "Could not create revision.")} disabled={mutating}>
                  Create Revision
                </button>
                <button type="button" className="btn-secondary" onClick={() => downloadPdf(doc)} disabled={mutating}>
                  Download PDF
                </button>
                <button type="button" className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600" onClick={() => run(() => LeadService.cancelDocument(doc.id), "Could not cancel document.")} disabled={mutating || doc.status === "ACCEPTED"}>
                  Cancel
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No documents yet" body="Create proposals, SOWs, agreements, NDAs, or custom documents from reusable templates." />
      )}
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

  async function copyOnboardingLink() {
    setMutating(true);
    setError("");
    try {
      const panel = (await LeadService.createCopyableClientOnboardingLink(params.id)) as ClientOnboardingPanel;
      const url = panel.latestLink?.url;
      if (url) await navigator.clipboard.writeText(url);
      setWorkspace((current) => (current ? { ...current, onboarding: panel, deal: { ...current.deal, onboardingStatus: panel.status } } : current));
    } catch {
      setError("Could not create a copyable onboarding link.");
    } finally {
      setMutating(false);
    }
  }

  async function shareOnboardingWhatsApp() {
    setMutating(true);
    setError("");
    try {
      const result = (await LeadService.shareClientOnboardingWhatsApp(params.id)) as ClientOnboardingPanel & {
        whatsapp?: { url: string };
      };
      if (result.whatsapp?.url) window.open(result.whatsapp.url, "_blank", "noopener,noreferrer");
      setWorkspace((current) => (current ? { ...current, onboarding: result, deal: { ...current.deal, onboardingStatus: result.status } } : current));
    } catch {
      setError("Could not create WhatsApp onboarding share link.");
    } finally {
      setMutating(false);
    }
  }

  async function downloadOnboardingPdf() {
    setMutating(true);
    setError("");
    try {
      const blob = await LeadService.downloadClientOnboardingPdf(params.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `client-onboarding-${params.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Could not download onboarding PDF.");
    } finally {
      setMutating(false);
    }
  }

  async function createProject(overrideReason?: string) {
    setMutating(true);
    setError("");
    try {
      const result = await LeadService.createProjectFromDeal(params.id, overrideReason ? { overrideReason } : {});
      const createdProject = result.project;
      setWorkspace((current) => (current ? { ...current, project: createdProject, kickoffReadiness: { ...(current.kickoffReadiness as KickoffReadiness), project: createdProject } } : current));
      setActiveTab("Project Kickoff");
    } catch {
      setError("Could not create project. Check kickoff readiness and permissions.");
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
              onCopyLink={copyOnboardingLink}
              onSendEmail={() => runOnboardingAction(() => LeadService.sendClientOnboardingEmail(params.id), "Could not send onboarding email.")}
              onShareWhatsApp={shareOnboardingWhatsApp}
              onDownloadPdf={downloadOnboardingPdf}
              onMarkSent={() => runOnboardingAction(() => LeadService.markClientOnboardingSent(params.id), "Could not mark onboarding as sent.")}
              onUnderReview={() =>
                runOnboardingAction(() => LeadService.markClientOnboardingUnderReview(params.id), "Could not mark onboarding under review.")
              }
              onComplete={() => runOnboardingAction(() => LeadService.markClientOnboardingCompleted(params.id), "Could not complete onboarding.")}
            />
          )}

          {activeTab === "Documents" && (
            <DocumentsPanel
              dealId={deal.id}
              projectId={workspace.project?.id}
              documents={workspace.documents || []}
              mutating={mutating}
              onReload={load}
              onError={setError}
            />
          )}

          {activeTab === "Project Kickoff" && (
            <ProjectKickoffPanel
              readiness={workspace.kickoffReadiness}
              project={workspace.project}
              mutating={mutating}
              onCreate={createProject}
            />
          )}
        </div>
      </section>
    </main>
  );
}
