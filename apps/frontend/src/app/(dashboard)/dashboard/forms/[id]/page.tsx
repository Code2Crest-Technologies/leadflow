'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FormsService } from '@/services';
import type { LeadFlowForm, PublicFormLink } from '@/types';
import { FormRenderer } from '@/components/forms/FormRenderer';

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700';
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

export default function FormDetailPage() {
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState<LeadFlowForm | null>(null);
  const [links, setLinks] = useState<PublicFormLink[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [formData, linkData] = await Promise.all([
        FormsService.getForm(params.id),
        FormsService.listPublicLinks(params.id),
      ]);
      setForm(formData);
      setLinks(linkData);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to load form.' : 'Failed to load form.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function publish() {
    setMutating(true);
    try {
      setForm(await FormsService.publishForm(params.id));
      setMessage('Form published.');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to publish form.' : 'Failed to publish form.');
    } finally {
      setMutating(false);
    }
  }

  async function archive() {
    setMutating(true);
    try {
      setForm(await FormsService.archiveForm(params.id));
      setMessage('Form archived.');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to archive form.' : 'Failed to archive form.');
    } finally {
      setMutating(false);
    }
  }

  async function createLink() {
    setMutating(true);
    setMessage('');
    try {
      const link = await FormsService.createPublicLink(params.id, {});
      setLinks((current) => [link, ...current]);
      setMessage(`Public link created: ${link.url}`);
      if (link.url) await navigator.clipboard.writeText(link.url).catch(() => undefined);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to create public link.' : 'Failed to create public link.');
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[var(--color-bg)] p-8 text-[var(--color-muted)]">Loading form...</main>;
  }

  if (!form) {
    return <main className="min-h-screen bg-[var(--color-bg)] p-8 text-red-700">{error || 'Form not found.'}</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Form preview</p>
            <h1 className="mt-2 text-4xl font-bold">{form.name}</h1>
            <p className="mt-2 text-[var(--color-muted)]">{form.description || 'No description.'}</p>
            <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(form.status)}`}>{form.status}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/forms" className="btn-secondary">Back</Link>
            <Link href={`/dashboard/forms/${form.id}/edit`} className="btn-secondary">Edit</Link>
            <Link href={`/dashboard/forms/${form.id}/submissions`} className="btn-secondary">Submissions</Link>
            <button type="button" onClick={publish} className="btn-secondary" disabled={mutating || form.status === 'ACTIVE'}>Publish</button>
            <button type="button" onClick={archive} className="btn-secondary" disabled={mutating || form.status === 'ARCHIVED'}>Archive</button>
            <button type="button" onClick={createLink} className="btn-primary" disabled={mutating || form.status !== 'ACTIVE'}>Create public link</button>
          </div>
        </div>

        {message && <p className="mt-6 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            {form.status === 'DRAFT' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Draft preview. This does not create a submission.</p>}
            <FormRenderer fields={form.fields || []} values={values} preview onChange={(key, value) => setValues({ ...values, [key]: value })} />
          </section>
          <section className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Public links</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Raw tokens are shown only once when created.</p>
            <div className="mt-4 space-y-3">
              {links.length === 0 ? (
                <p className="rounded-xl bg-[var(--color-bg)] p-4 text-sm text-[var(--color-muted)]">No public links yet.</p>
              ) : links.map((link) => (
                <div key={link.id} className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
                  <p className="font-semibold">{link.isActive ? 'Active' : 'Inactive'} · {link.usedCount}{link.maxUses ? `/${link.maxUses}` : ''} uses</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'No expiry'}</p>
                  {link.url && <p className="mt-2 break-all text-xs text-emerald-700">{link.url}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
