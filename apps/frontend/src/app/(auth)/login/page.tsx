'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import PasswordInput from '@/components/shared/PasswordInput';
import { MailIcon } from '@/components/ui/Icons';
import { AuthService } from '@/services';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPortalLogin, setShowPortalLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portal.code2crest.com';
  const portalProductsUrl = `${portalBaseUrl.replace(/\/$/, '')}/products`;

  useEffect(() => {
    if (localStorage.getItem('authToken')) router.replace('/dashboard');
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setShowPortalLogin(false);
    setLoading(true);
    try {
      await AuthService.login(email, password);
      router.replace('/dashboard');
      router.refresh();
    } catch (requestError) {
      const responseError = axios.isAxiosError(requestError)
        ? requestError.response?.data?.error
        : undefined;

      if (responseError === 'this_account_is_managed_by_portal') {
        setShowPortalLogin(true);
        setError('This account is managed by Code2Crest Hub. Please sign in through the Hub.');
      } else {
        setError(responseError || 'Unable to sign in');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[var(--color-bg)] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[var(--color-primary)] p-14 text-white lg:flex">
        <div className="text-xl font-bold tracking-tight">LeadFlow</div>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/70">CRM workspace</p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">Turn every lead conversation into follow-up, quote, and invoice.</h1>
          <p className="mt-5 max-w-lg text-lg text-white/75">
            WhatsApp-focused CRM for leads, follow-ups, quotations and invoices.
          </p>
        </div>
        <p className="text-sm text-white/70">Access is managed by Code2Crest Hub.</p>
      </section>
      <section className="flex items-center justify-center bg-[var(--color-bg)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white">
              <Image src="/icon.png" alt="LeadFlow" width={44} height={44} className="h-10 w-10 object-contain" priority />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-950">LeadFlow</p>
              <p className="text-xs text-slate-500">Code2Crest CRM</p>
            </div>
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-slate-500">
            WhatsApp-focused CRM for leads, follow-ups, quotations and invoices.
          </p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block text-sm font-medium text-slate-700">Email
              <span className="relative mt-2 block">
                <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input-field pl-10" placeholder="name@company.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </span>
            </label>
            <label className="block text-sm font-medium text-slate-700">Password
              <PasswordInput className="mt-2" value={password} onChange={setPassword} required minLength={8} />
            </label>
            <div className="flex justify-end">
              <button type="button" className="text-sm font-semibold text-emerald-700">
                Forgot password?
              </button>
            </div>
            {error && (
              <div className="space-y-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <p>{error}</p>
                {showPortalLogin && (
                  <a
                    href={portalProductsUrl}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition hover:bg-[#063F3A]"
                  >
                    Continue with Code2Crest Hub
                  </a>
                )}
              </div>
            )}
            <button disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Access is managed by Code2Crest Hub.
          </p>
        </div>
      </section>
    </main>
  );
}
