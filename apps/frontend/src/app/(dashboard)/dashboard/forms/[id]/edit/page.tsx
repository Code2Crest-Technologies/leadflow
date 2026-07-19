'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormsService, type FieldPayload } from '@/services';
import type { FormPurpose, LeadFlowForm, LeadFlowFormField } from '@/types';

const purposes: FormPurpose[] = ['GENERAL', 'CLIENT_ONBOARDING', 'REQUIREMENTS', 'LEAD_CAPTURE', 'SURVEY', 'FEEDBACK', 'SERVICE_REQUEST'];

export default function EditFormPage() {
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState<LeadFlowForm | null>(null);
  const [meta, setMeta] = useState({ name: '', slug: '', description: '', purpose: 'GENERAL' as FormPurpose });
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await FormsService.getForm(params.id);
      setForm(data);
      setMeta({ name: data.name, slug: data.slug, description: data.description || '', purpose: data.purpose });
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to load form.' : 'Failed to load form.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function saveMeta(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await FormsService.updateForm(params.id, meta);
      setForm(updated);
      setMessage('Form details saved.');
    } catch (requestError) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.error || 'Failed to save form.' : 'Failed to save form.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshFields() {
    const data = await FormsService.getForm(params.id);
    setForm(data);
  }

  async function addField(payload: FieldPayload) {
    setSaving(true);
    try {
      await FormsService.createField(params.id, payload);
      await refreshFields();
    } finally {
      setSaving(false);
    }
  }

  async function updateField(fieldId: string, payload: FieldPayload) {
    setSaving(true);
    try {
      await FormsService.updateField(params.id, fieldId, payload);
      await refreshFields();
    } finally {
      setSaving(false);
    }
  }

  async function deleteField(fieldId: string) {
    setSaving(true);
    try {
      await FormsService.deleteField(params.id, fieldId);
      await refreshFields();
    } finally {
      setSaving(false);
    }
  }

  async function moveFields(fieldIds: string[]) {
    const fields = await FormsService.reorderFields(params.id, fieldIds);
    setForm((current) => current ? { ...current, fields: fields as LeadFlowFormField[] } : current);
  }

  if (loading) return <main className="min-h-screen bg-[var(--color-bg)] p-8 text-[var(--color-muted)]">Loading form...</main>;
  if (!form) return <main className="min-h-screen bg-[var(--color-bg)] p-8 text-red-700">{error || 'Form not found.'}</main>;

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Form builder</p>
            <h1 className="mt-2 text-4xl font-bold">Edit {form.name}</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/dashboard/forms/${form.id}`} className="btn-secondary">Preview</Link>
            <Link href="/dashboard/forms" className="btn-secondary">Back</Link>
          </div>
        </div>

        {message && <p className="mt-6 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <form onSubmit={saveMeta} className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Form details</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input className="input-field" placeholder="Form name" value={meta.name} onChange={(event) => setMeta({ ...meta, name: event.target.value })} required />
            <input className="input-field" placeholder="Slug" value={meta.slug} onChange={(event) => setMeta({ ...meta, slug: event.target.value })} />
            <select className="input-field" value={meta.purpose} onChange={(event) => setMeta({ ...meta, purpose: event.target.value as FormPurpose })}>
              {purposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
            </select>
            <textarea className="input-field min-h-24 md:col-span-2" placeholder="Description" value={meta.description} onChange={(event) => setMeta({ ...meta, description: event.target.value })} />
          </div>
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save details'}</button>
          </div>
        </form>

        <div className="mt-8">
          <FormBuilder
            fields={form.fields || []}
            saving={saving}
            onAdd={addField}
            onUpdate={updateField}
            onDelete={deleteField}
            onMove={moveFields}
          />
        </div>

        <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Preview</h2>
          <p className="mb-4 mt-1 text-sm text-[var(--color-muted)]">Draft preview only. It will not create a submission.</p>
          <FormRenderer fields={form.fields || []} values={previewValues} preview onChange={(key, value) => setPreviewValues({ ...previewValues, [key]: value })} />
        </section>
      </div>
    </main>
  );
}
