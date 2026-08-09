"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { LeadService } from "@/services";

interface PublicDocumentPayload {
  document: {
    title: string;
    type: string;
    status: string;
    expiresAt?: string | null;
    generatedAt: string;
  };
  company: {
    name: string;
    logoUrl?: string | null;
    email?: string | null;
    website?: string | null;
  };
  client: {
    name: string;
    email?: string | null;
  };
  project?: {
    name: string;
    serviceType?: string | null;
  } | null;
  deal?: {
    title: string;
  } | null;
  version: {
    id: string;
    versionNumber: number;
    renderedContent: string;
  };
  acceptance?: {
    acceptedByName: string;
    acceptedByEmail: string;
    acceptedAt: string;
  } | null;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export default function PublicDocumentPage({ params }: { params: { token: string } }) {
  const [payload, setPayload] = useState<PublicDocumentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [acceptForm, setAcceptForm] = useState({ fullName: "", email: "", designation: "", confirmed: false });
  const [rejectForm, setRejectForm] = useState({ reason: "", comments: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await LeadService.getPublicDocument(params.token);
      setPayload(data);
      setAcceptForm((current) => ({ ...current, fullName: data.client.name || "", email: data.client.email || "" }));
    } catch {
      setError("This document link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.token]);

  async function accept(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setError("");
    setSuccess("");
    try {
      await LeadService.acceptPublicDocument(params.token, acceptForm);
      setSuccess("Document accepted successfully.");
      await load();
    } catch {
      setError("Could not accept this document. Please check the required fields and link status.");
    } finally {
      setMutating(false);
    }
  }

  async function reject(event: FormEvent) {
    event.preventDefault();
    setMutating(true);
    setError("");
    setSuccess("");
    try {
      await LeadService.rejectPublicDocument(params.token, rejectForm);
      setSuccess("Your change request was submitted.");
      await load();
    } catch {
      setError("Could not submit the rejection. Please enter a reason.");
    } finally {
      setMutating(false);
    }
  }

  async function downloadPdf() {
    try {
      const blob = await LeadService.downloadPublicDocumentPdf(params.token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${payload?.document.title || "document"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Could not download PDF.");
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#F0EDE4] p-5"><div className="mx-auto h-96 max-w-4xl animate-pulse rounded-2xl bg-white" /></main>;
  }

  if (!payload) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0EDE4] p-5">
        <section className="max-w-lg rounded-2xl border border-[#DDD8CD] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-[#10201D]">Document unavailable</h1>
          <p className="mt-3 text-[#6B7A75]">{error || "This document link has expired."}</p>
          <p className="mt-5 text-sm text-[#6B7A75]">Please contact Code2Crest for a fresh review link.</p>
        </section>
      </main>
    );
  }

  const canRespond = ["SENT", "VIEWED", "READY"].includes(payload.document.status);

  return (
    <main className="min-h-screen bg-[#F0EDE4] p-4 md:p-8">
      <section className="mx-auto max-w-5xl rounded-2xl border border-[#DDD8CD] bg-white shadow-sm">
        <header className="flex flex-col gap-5 border-b border-[#DDD8CD] p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            {payload.company.logoUrl ? (
              <Image src={payload.company.logoUrl} alt={payload.company.name} width={56} height={56} className="h-14 w-14 rounded-xl object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#004741] font-bold text-white">LF</div>
            )}
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#0F766E]">Client Review</p>
              <h1 className="mt-2 text-2xl font-bold text-[#10201D]">{payload.document.title}</h1>
              <p className="mt-1 text-sm text-[#6B7A75]">
                {payload.document.type} · Version {payload.version.versionNumber} · Generated {formatDate(payload.document.generatedAt)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F0EDE4] p-4 text-sm text-[#10201D]">
            <p><strong>Client:</strong> {payload.client.name}</p>
            <p><strong>Project:</strong> {payload.project?.name || payload.deal?.title || "Project"}</p>
            <p><strong>Status:</strong> {payload.document.status}</p>
            <p><strong>Expires:</strong> {formatDate(payload.document.expiresAt)}</p>
          </div>
        </header>

        {error && <p className="mx-6 mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {success && <p className="mx-6 mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</p>}

        <article className="prose prose-slate max-w-none p-6" dangerouslySetInnerHTML={{ __html: payload.version.renderedContent }} />

        {payload.acceptance && (
          <section className="mx-6 mb-6 rounded-2xl bg-emerald-50 p-5 text-emerald-800">
            <h2 className="font-bold">Accepted</h2>
            <p className="mt-2 text-sm">
              Accepted by {payload.acceptance.acceptedByName} ({payload.acceptance.acceptedByEmail}) on {formatDate(payload.acceptance.acceptedAt)}.
            </p>
          </section>
        )}

        <section className="grid gap-5 border-t border-[#DDD8CD] p-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#DDD8CD] p-5">
            <h2 className="font-bold text-[#10201D]">Accept Document</h2>
            <form onSubmit={accept} className="mt-4 space-y-3">
              <input className="input-field" placeholder="Full name" value={acceptForm.fullName} onChange={(event) => setAcceptForm({ ...acceptForm, fullName: event.target.value })} disabled={!canRespond || mutating} />
              <input className="input-field" placeholder="Email" value={acceptForm.email} onChange={(event) => setAcceptForm({ ...acceptForm, email: event.target.value })} disabled={!canRespond || mutating} />
              <input className="input-field" placeholder="Designation (optional)" value={acceptForm.designation} onChange={(event) => setAcceptForm({ ...acceptForm, designation: event.target.value })} disabled={!canRespond || mutating} />
              <label className="flex gap-3 text-sm text-[#6B7A75]">
                <input type="checkbox" checked={acceptForm.confirmed} onChange={(event) => setAcceptForm({ ...acceptForm, confirmed: event.target.checked })} disabled={!canRespond || mutating} />
                I confirm that I have reviewed and accept this document.
              </label>
              <button className="btn-primary w-full justify-center" disabled={!canRespond || mutating || !acceptForm.confirmed}>Accept Document</button>
            </form>
          </div>

          <div className="rounded-2xl border border-[#DDD8CD] p-5">
            <h2 className="font-bold text-[#10201D]">Request Changes</h2>
            <form onSubmit={reject} className="mt-4 space-y-3">
              <input className="input-field" placeholder="Reason" value={rejectForm.reason} onChange={(event) => setRejectForm({ ...rejectForm, reason: event.target.value })} disabled={!canRespond || mutating} />
              <textarea className="input-field min-h-24" placeholder="Comments (optional)" value={rejectForm.comments} onChange={(event) => setRejectForm({ ...rejectForm, comments: event.target.value })} disabled={!canRespond || mutating} />
              <button className="btn-secondary w-full justify-center" disabled={!canRespond || mutating || !rejectForm.reason.trim()}>Reject / Request Changes</button>
            </form>
            <button type="button" onClick={downloadPdf} className="btn-secondary mt-3 w-full justify-center">Download PDF</button>
          </div>
        </section>
      </section>
    </main>
  );
}
