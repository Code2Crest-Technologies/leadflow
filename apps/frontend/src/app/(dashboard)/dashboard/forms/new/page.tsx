'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { FormsService } from '@/services';
import type { FormPurpose } from '@/types';

const purposes: FormPurpose[] = ['GENERAL', 'CLIENT_ONBOARDING', 'REQUIREMENTS', 'LEAD_CAPTURE', 'SURVEY', 'FEEDBACK', 'SERVICE_REQUEST'];

export default function NewFormPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', slug: '', description: '', purpose: 'GENERAL' as FormPurpose });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await FormsService.createForm(form);
      router.push(`/dashboard/forms/${created.id}/edit`);
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to create form.' : 'Failed to create form.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">New Form</p>
        <h1 className="mt-2 text-4xl font-bold">Create Form</h1>
        <form onSubmit={save} className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <div className="grid gap-4">
            <input className="input-field" placeholder="Form name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <input className="input-field" placeholder="Optional slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            <select className="input-field" value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as FormPurpose })}>
              {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
            </select>
            <textarea className="input-field min-h-28" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => router.push('/dashboard/forms')}>Cancel</button>
            <button className="btn-primary" disabled={saving || !form.name.trim()}>{saving ? 'Creating...' : 'Create Form'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}
