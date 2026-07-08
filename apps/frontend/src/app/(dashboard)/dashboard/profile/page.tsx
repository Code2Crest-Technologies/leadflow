'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient } from '@/services';
import type { User } from '@/types';

type ProfileData = User & {
  company?: {
    id: string;
    name: string;
  };
};

const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.code2crest.com';

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  const isPortalUser = profile?.authProvider === 'PORTAL';

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const response = await apiClient.get('/api/users/me');
        if (mounted) setProfile(response.data.data);
      } catch {
        if (mounted) setError('Failed to load profile.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await apiClient.patch('/api/users/me/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setMessage('Password updated successfully.');
    } catch (requestError) {
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.error || 'Failed to update password.'
          : 'Failed to update password.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Account</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--color-text)]">Profile</h1>
        <p className="mt-2 text-[var(--color-muted)]">Manage your LeadFlow account access and sign-in details.</p>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Account details</h2>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--color-muted)]">Loading profile...</p>
            ) : profile ? (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Name</dt>
                  <dd className="mt-1 font-semibold">{profile.firstName} {profile.lastName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Email</dt>
                  <dd className="mt-1 font-semibold">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Role</dt>
                  <dd className="mt-1 font-semibold">{profile.role}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Company</dt>
                  <dd className="mt-1 font-semibold">{profile.company?.name || profile.companyName || 'Not available'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Last login</dt>
                  <dd className="mt-1 font-semibold">{formatDate(profile.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">Access type</dt>
                  <dd className="mt-1 font-semibold">{profile.authProvider || 'LOCAL'}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-red-600">Profile unavailable.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Sign-in security</h2>
            {isPortalUser ? (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">This account is managed through Code2Crest Hub.</p>
                <p className="mt-2 text-sm text-emerald-800">Use the Hub to manage password, company access, and product permissions.</p>
                <a href={portalBaseUrl} className="btn-primary mt-4 inline-flex">
                  Open Code2Crest Hub
                </a>
              </div>
            ) : (
              <form onSubmit={changePassword} className="mt-5 space-y-4">
                <label className="block text-sm font-semibold">
                  Current password
                  <input
                    type="password"
                    className="input-field mt-2"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    required
                  />
                </label>
                <label className="block text-sm font-semibold">
                  New password
                  <input
                    type="password"
                    className="input-field mt-2"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    minLength={8}
                    required
                  />
                </label>
                <button disabled={saving} className="btn-primary disabled:opacity-60">
                  {saving ? 'Updating...' : 'Update password'}
                </button>
              </form>
            )}

            {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
