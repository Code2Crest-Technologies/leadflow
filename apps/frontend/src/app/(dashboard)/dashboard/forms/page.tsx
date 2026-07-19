'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { FormsService } from '@/services';
import type { LeadFlowForm } from '@/types';
import { PlusIcon } from '@/components/ui/Icons';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

export default function FormsPage() {
  const [forms, setForms] = useState<LeadFlowForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    FormsService.listForms()
      .then((data) => {
        if (mounted) setForms(data);
      })
      .catch((requestError) => {
        if (mounted) {
          setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to load forms.' : 'Failed to load forms.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Forms</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--color-text)]">Forms</h1>
            <p className="mt-2 text-[var(--color-muted)]">Build onboarding, requirements, feedback, survey, and lead capture forms.</p>
          </div>
          <Link href="/dashboard/forms/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" />Create Form
          </Link>
        </div>

        {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <section className="mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-[var(--color-muted)]">Loading forms...</div>
          ) : forms.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">No forms yet</h2>
              <p className="mt-2 text-[var(--color-muted)]">Create your first form to collect structured information from customers.</p>
              <Link href="/dashboard/forms/new" className="btn-primary mt-5 inline-flex">Create your first form</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--color-bg)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="px-5 py-4">Name</th>
                    <th className="px-5 py-4">Purpose</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Fields</th>
                    <th className="px-5 py-4">Submissions</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {forms.map((form) => (
                    <tr key={form.id}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-[var(--color-text)]">{form.name}</p>
                        <p className="text-xs text-[var(--color-muted)]">/{form.slug}</p>
                      </td>
                      <td className="px-5 py-4 text-[var(--color-muted)]">{form.purpose.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(form.status)}`}>{form.status}</span></td>
                      <td className="px-5 py-4">{form._count?.fields ?? 0}</td>
                      <td className="px-5 py-4">{form._count?.submissions ?? 0}</td>
                      <td className="px-5 py-4 text-[var(--color-muted)]">{formatDate(form.updatedAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/dashboard/forms/${form.id}`} className="btn-secondary h-9 px-3">Preview</Link>
                          <Link href={`/dashboard/forms/${form.id}/edit`} className="btn-secondary h-9 px-3">Edit</Link>
                          <Link href={`/dashboard/forms/${form.id}/submissions`} className="btn-secondary h-9 px-3">Submissions</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
