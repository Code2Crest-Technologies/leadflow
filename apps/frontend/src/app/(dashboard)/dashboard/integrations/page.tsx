'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient, AuthService } from '@/services';

interface IntegrationSettings {
  whatsapp: {
    whatsappBusinessAccountId: string | null;
    phoneNumberId: string | null;
    accessToken: string | null;
    verifyToken: string | null;
    webhookUrl: string;
    status: string;
  };
  meta: {
    metaAppId: string | null;
    metaAppSecret: string | null;
    businessManagerId: string | null;
    facebookPageId: string | null;
    instagramBusinessAccountId: string | null;
    status: string;
  };
  webhook: {
    url: string;
    status: string;
  };
}

const emptySettings: IntegrationSettings = {
  whatsapp: {
    whatsappBusinessAccountId: '',
    phoneNumberId: '',
    accessToken: '',
    verifyToken: '',
    webhookUrl: '',
    status: 'not_configured',
  },
  meta: {
    metaAppId: '',
    metaAppSecret: '',
    businessManagerId: '',
    facebookPageId: '',
    instagramBusinessAccountId: '',
    status: 'not_configured',
  },
  webhook: {
    url: '',
    status: 'waiting_for_whatsapp_credentials',
  },
};

function normalizeSettings(data: IntegrationSettings): IntegrationSettings {
  return {
    whatsapp: {
      ...data.whatsapp,
      whatsappBusinessAccountId: data.whatsapp.whatsappBusinessAccountId || '',
      phoneNumberId: data.whatsapp.phoneNumberId || '',
      accessToken: data.whatsapp.accessToken || '',
      verifyToken: data.whatsapp.verifyToken || '',
    },
    meta: {
      ...data.meta,
      metaAppId: data.meta.metaAppId || '',
      metaAppSecret: data.meta.metaAppSecret || '',
      businessManagerId: data.meta.businessManagerId || '',
      facebookPageId: data.meta.facebookPageId || '',
      instagramBusinessAccountId: data.meta.instagramBusinessAccountId || '',
    },
    webhook: data.webhook,
  };
}

function StatusBadge({ value }: { value: string }) {
  const ready = value === 'configured' || value === 'ready';
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function SecretInput({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string;
  value: string | null;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-[var(--color-text)]">
      {label}
      <span className="mt-2 flex gap-2">
        <input
          className="input-field"
          type={visible ? 'text' : 'password'}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
        <button type="button" onClick={onToggle} className="btn-secondary shrink-0">
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [error, setError] = useState('');
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const user = AuthService.getUser();
    const admin = user?.role === 'ADMIN';
    setIsAdmin(admin);

    async function loadSettings() {
      try {
        const response = await apiClient.get('/api/integrations/settings');
        if (mounted) setSettings(normalizeSettings(response.data.data));
      } catch (requestError) {
        if (mounted) {
          setError(
            axios.isAxiosError(requestError)
              ? requestError.response?.data?.error || 'Failed to load integration settings.'
              : 'Failed to load integration settings.',
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (admin) loadSettings();
    else setLoading(false);

    return () => {
      mounted = false;
    };
  }, []);

  function updateWhatsApp(field: keyof IntegrationSettings['whatsapp'], value: string) {
    setSettings((current) => ({
      ...current,
      whatsapp: { ...current.whatsapp, [field]: value },
    }));
  }

  function updateMeta(field: keyof IntegrationSettings['meta'], value: string) {
    setSettings((current) => ({
      ...current,
      meta: { ...current.meta, [field]: value },
    }));
  }

  function toggleSecret(key: string) {
    setVisibleSecrets((current) => ({ ...current, [key]: !current[key] }));
  }

  async function copyWebhookUrl() {
    const webhookUrl = settings.whatsapp.webhookUrl || settings.webhook.url;
    if (!webhookUrl) return;

    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopyMessage('Webhook URL copied.');
      window.setTimeout(() => setCopyMessage(''), 2400);
    } catch {
      setError('Unable to copy webhook URL.');
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await apiClient.patch('/api/integrations/settings', {
        whatsapp: {
          whatsappBusinessAccountId: settings.whatsapp.whatsappBusinessAccountId || '',
          phoneNumberId: settings.whatsapp.phoneNumberId || '',
          accessToken: settings.whatsapp.accessToken || '',
          verifyToken: settings.whatsapp.verifyToken || '',
        },
        meta: {
          metaAppId: settings.meta.metaAppId || '',
          metaAppSecret: settings.meta.metaAppSecret || '',
          businessManagerId: settings.meta.businessManagerId || '',
          facebookPageId: settings.meta.facebookPageId || '',
          instagramBusinessAccountId: settings.meta.instagramBusinessAccountId || '',
        },
      });
      const response = await apiClient.get('/api/integrations/settings');
      setSettings(normalizeSettings(response.data.data));
      setVisibleSecrets({});
      setMessage('Integration settings saved securely.');
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.error || 'Failed to save integration settings.'
          : 'Failed to save integration settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === false) {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2 text-[var(--color-muted)]">Only admins can manage integrations.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Admin settings</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--color-text)]">Integrations</h1>
            <p className="mt-2 text-[var(--color-muted)]">Connect Meta and WhatsApp channels used by LeadFlow.</p>
          </div>
          <StatusBadge value={settings.webhook.status} />
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-white p-6 text-[var(--color-muted)] shadow-sm">
            Loading integration settings...
          </div>
        ) : (
          <form onSubmit={saveSettings} className="mt-8 space-y-6">
            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">WhatsApp Business API</h2>
                  <p className="text-sm text-[var(--color-muted)]">Credentials are stored on the backend and masked in the UI.</p>
                </div>
                <StatusBadge value={settings.whatsapp.status} />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  WhatsApp Business Account ID
                  <input className="input-field mt-2" value={settings.whatsapp.whatsappBusinessAccountId || ''} onChange={(event) => updateWhatsApp('whatsappBusinessAccountId', event.target.value)} />
                </label>
                <label className="block text-sm font-semibold">
                  Phone Number ID
                  <input className="input-field mt-2" value={settings.whatsapp.phoneNumberId || ''} onChange={(event) => updateWhatsApp('phoneNumberId', event.target.value)} />
                </label>
                <SecretInput label="Access Token" value={settings.whatsapp.accessToken} visible={Boolean(visibleSecrets.accessToken)} onToggle={() => toggleSecret('accessToken')} onChange={(value) => updateWhatsApp('accessToken', value)} />
                <SecretInput label="Verify Token" value={settings.whatsapp.verifyToken} visible={Boolean(visibleSecrets.verifyToken)} onToggle={() => toggleSecret('verifyToken')} onChange={(value) => updateWhatsApp('verifyToken', value)} />
                <label className="block text-sm font-semibold md:col-span-2">
                  Webhook URL
                  <span className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input className="input-field bg-slate-50" value={settings.whatsapp.webhookUrl || settings.webhook.url} readOnly />
                    <button type="button" onClick={copyWebhookUrl} className="btn-secondary shrink-0">
                      Copy
                    </button>
                  </span>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Meta Business</h2>
                  <p className="text-sm text-[var(--color-muted)]">Use these settings for Facebook Page and Instagram lead sources.</p>
                </div>
                <StatusBadge value={settings.meta.status} />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Meta App ID
                  <input className="input-field mt-2" value={settings.meta.metaAppId || ''} onChange={(event) => updateMeta('metaAppId', event.target.value)} />
                </label>
                <SecretInput label="Meta App Secret" value={settings.meta.metaAppSecret} visible={Boolean(visibleSecrets.metaAppSecret)} onToggle={() => toggleSecret('metaAppSecret')} onChange={(value) => updateMeta('metaAppSecret', value)} />
                <label className="block text-sm font-semibold">
                  Business Manager ID
                  <input className="input-field mt-2" value={settings.meta.businessManagerId || ''} onChange={(event) => updateMeta('businessManagerId', event.target.value)} />
                </label>
                <label className="block text-sm font-semibold">
                  Facebook Page ID
                  <input className="input-field mt-2" value={settings.meta.facebookPageId || ''} onChange={(event) => updateMeta('facebookPageId', event.target.value)} />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Instagram Business Account ID
                  <input className="input-field mt-2" value={settings.meta.instagramBusinessAccountId || ''} onChange={(event) => updateMeta('instagramBusinessAccountId', event.target.value)} />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Webhook status</h2>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[var(--color-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Inbound webhook endpoint</p>
                  <p className="break-all text-sm text-[var(--color-muted)]">{settings.webhook.url}</p>
                </div>
                <StatusBadge value={settings.webhook.status} />
              </div>
            </section>

            {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
            {copyMessage && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{copyMessage}</p>}
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="flex justify-end">
              <button disabled={saving} className="btn-primary disabled:opacity-60">
                {saving ? 'Saving...' : 'Save integrations'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
