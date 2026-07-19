'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FormsService } from '@/services';
import type { FormSubmission, LeadFlowForm } from '@/types';

function displayName(submission: FormSubmission) {
  return submission.submittedByName || submission.submittedByEmail || 'Anonymous submission';
}

function valueToText(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return 'Not provided';
  return String(value);
}

export default function FormSubmissionsPage() {
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState<LeadFlowForm | null>(null);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selected, setSelected] = useState<FormSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [formData, submissionData] = await Promise.all([
        FormsService.getForm(params.id),
        FormsService.listSubmissions(params.id),
      ]);
      setForm(formData);
      setSubmissions(submissionData);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to load submissions.' : 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function openSubmission(submissionId: string) {
    setMutating(true);
    try {
      setSelected(await FormsService.getSubmission(params.id, submissionId));
    } finally {
      setMutating(false);
    }
  }

  async function updateStatus(status: 'REVIEWED' | 'COMPLETED') {
    if (!selected) return;
    setMutating(true);
    try {
      await FormsService.updateSubmissionStatus(params.id, selected.id, status);
      const refreshed = await FormsService.getSubmission(params.id, selected.id);
      setSelected(refreshed);
      setSubmissions((current) => current.map((item) => item.id === refreshed.id ? { ...item, status: refreshed.status } : item));
    } finally {
      setMutating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Submissions</p>
            <h1 className="mt-2 text-4xl font-bold">{form?.name || 'Form submissions'}</h1>
          </div>
          <Link href={`/dashboard/forms/${params.id}`} className="btn-secondary">Back to form</Link>
        </div>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
            {loading ? (
              <p className="p-6 text-[var(--color-muted)]">Loading submissions...</p>
            ) : submissions.length === 0 ? (
              <div className="p-10 text-center text-[var(--color-muted)]">No submissions yet.</div>
            ) : (
              <div className="max-h-[680px] divide-y divide-[var(--color-border)] overflow-y-auto">
                {submissions.map((submission) => (
                  <button
                    key={submission.id}
                    type="button"
                    onClick={() => openSubmission(submission.id)}
                    className={`block w-full p-5 text-left hover:bg-[var(--color-bg)] ${selected?.id === submission.id ? 'bg-[var(--color-bg)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{displayName(submission)}</p>
                        <p className="text-sm text-[var(--color-muted)]">{new Date(submission.submittedAt).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{submission.status}</span>
                    </div>
                    {submission.deal && <p className="mt-2 text-sm text-[var(--color-muted)]">Deal: {submission.deal.title}</p>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            {!selected ? (
              <div className="flex min-h-[360px] items-center justify-center text-center text-[var(--color-muted)]">
                Select a submission to view details.
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{displayName(selected)}</h2>
                    <p className="text-sm text-[var(--color-muted)]">{new Date(selected.submittedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" onClick={() => updateStatus('REVIEWED')} disabled={mutating || selected.status === 'REVIEWED'}>Mark reviewed</button>
                    <button type="button" className="btn-primary" onClick={() => updateStatus('COMPLETED')} disabled={mutating || selected.status === 'COMPLETED'}>Mark completed</button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--color-bg)] p-4">
                    <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Contact</p>
                    <p className="mt-1 font-semibold">{selected.contact ? `${selected.contact.firstName} ${selected.contact.lastName || ''}`.trim() : 'Not linked'}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-bg)] p-4">
                    <p className="text-xs font-bold uppercase text-[var(--color-muted)]">Deal</p>
                    <p className="mt-1 font-semibold">{selected.deal?.title || 'Not linked'}</p>
                  </div>
                </div>

                <div className="mt-6 divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
                  {(selected.values || []).map((item) => (
                    <div key={item.id} className="grid gap-2 p-4 md:grid-cols-[240px_1fr]">
                      <p className="font-semibold text-[var(--color-text)]">{item.field.label}</p>
                      <p className="whitespace-pre-wrap text-[var(--color-muted)]">{valueToText(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
