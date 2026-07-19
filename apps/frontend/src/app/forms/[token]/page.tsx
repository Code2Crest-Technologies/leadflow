'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormsService } from '@/services';
import type { PublicFormPayload } from '@/types';

export default function PublicFormPage() {
  const params = useParams<{ token: string }>();
  const [payload, setPayload] = useState<PublicFormPayload | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    FormsService.getPublicForm(params.token)
      .then((data) => {
        if (mounted) {
          setPayload(data);
          setValues(data.prefill || {});
        }
      })
      .catch((requestError) => {
        if (mounted) {
          setError(
            axios.isAxiosError(requestError)
              ? requestError.response?.data?.error || 'This form link is invalid or has expired.'
              : 'This form link is invalid or has expired.',
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [params.token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      await FormsService.submitPublicForm(params.token, values, website);
      setSubmitted(true);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        setFieldErrors(requestError.response?.data?.fieldErrors || {});
        setError(requestError.response?.data?.error || 'Please check the form and try again.');
      } else {
        setError('Please check the form and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
          {loading ? (
            <p className="text-[var(--color-muted)]">Loading form...</p>
          ) : error && !payload ? (
            <div className="py-12 text-center">
              <h1 className="text-2xl font-bold">This form link is invalid or has expired.</h1>
              <p className="mt-2 text-[var(--color-muted)]">Please contact the business that shared this link.</p>
            </div>
          ) : submitted ? (
            <div className="py-12 text-center">
              <h1 className="text-2xl font-bold">Thank you.</h1>
              <p className="mt-2 text-[var(--color-muted)]">Your response has been submitted successfully.</p>
            </div>
          ) : payload ? (
            <form onSubmit={submit}>
              <div className="mb-8 flex items-start gap-4">
                {payload.company.logoUrl && (
                  <Image src={payload.company.logoUrl} alt={payload.company.name} width={56} height={56} className="rounded-xl object-contain" />
                )}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{payload.company.name}</p>
                  <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">{payload.form.name}</h1>
                  {payload.form.description && <p className="mt-2 text-[var(--color-muted)]">{payload.form.description}</p>}
                  {payload.form.purpose === 'CLIENT_ONBOARDING' && (
                    <div className="mt-4 space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p>
                        Thank you for choosing Code2Crest Technologies. Please complete the following information so our team can understand your business and project requirements before kickoff.
                      </p>
                      <p className="font-semibold">Please do not enter passwords, OTPs, banking credentials, or secret API keys.</p>
                    </div>
                  )}
                </div>
              </div>
              <input tabIndex={-1} className="hidden" value={website} onChange={(event) => setWebsite(event.target.value)} autoComplete="off" />
              <FormRenderer
                fields={payload.form.fields}
                values={values}
                errors={fieldErrors}
                disabled={submitting}
                onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
              />
              {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="mt-8 flex justify-end">
                <button className="btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit response'}</button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
