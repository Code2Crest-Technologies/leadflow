'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { FormRenderer } from '@/components/forms/FormRenderer';
import { FormsService } from '@/services';
import type { LeadFlowFormField, PublicFormPayload } from '@/types';

const CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY = 'CODE2CREST_CLIENT_ONBOARDING';

const businessKeys = [
  'primaryContactName',
  'companyName',
  'businessEmail',
  'phone',
  'whatsappNumber',
  'businessWebsite',
  'industry',
  'businessAddress',
  'gstin',
];
const projectKeys = [
  'projectName',
  'serviceType',
  'projectSummary',
  'primaryBusinessGoal',
  'targetAudience',
  'referenceWebsites',
  'competitors',
  'expectedLaunchDate',
];
const brandKeys = [
  'hasLogo',
  'brandColors',
  'brandFonts',
  'brandGuidelinesAvailable',
  'brandingNotes',
  'contentProvider',
  'hasCompanyProfile',
  'hasProductServiceContent',
  'hasImages',
  'hasVideos',
  'contentNotes',
];
const websiteKeys = [
  'existingDomain',
  'domainName',
  'domainProvider',
  'existingHosting',
  'hostingProvider',
  'estimatedPages',
  'cmsRequired',
  'blogRequired',
  'whatsappIntegration',
  'paymentGatewayRequired',
  'multilingualRequired',
  'seoRequired',
  'analyticsRequired',
  'googleBusinessProfileRequired',
];
const softwareKeys = [
  'userRolesRequired',
  'coreFeatures',
  'adminDashboardRequired',
  'authenticationRequired',
  'paymentIntegrationRequired',
  'thirdPartyIntegrations',
  'reportsRequired',
  'notificationsRequired',
  'existingApis',
  'expectedUsers',
];
const maintenanceKeys = ['existingSystemUrl', 'currentTechnology', 'supportType', 'issueSummary', 'maintenanceFrequency', 'accessRequired'];
const technicalKeys = ['domainAccessRequired', 'hostingAccessRequired', 'googleAccessRequired', 'metaBusinessAccessRequired', 'technicalNotes'];
const finalKeys = ['additionalRequirements', 'informationConfirmed', 'onboardingConsent'];

const websiteServiceTypes = new Set(['Website Development', 'Web Application Development', 'E-Commerce Solutions']);
const softwareServiceTypes = new Set(['Mobile App Development', 'Custom Software Development', 'SaaS / Product Development']);
const maintenanceServiceTypes = new Set(['Maintenance & Support']);

function isMissing(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isSerializableValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function valueLabel(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function getVisibleKeys(values: Record<string, unknown>) {
  const serviceType = typeof values.serviceType === 'string' ? values.serviceType : '';
  const keys = new Set([...businessKeys, ...projectKeys, ...finalKeys]);

  if (!serviceType || websiteServiceTypes.has(serviceType) || softwareServiceTypes.has(serviceType) || serviceType === 'Other') {
    brandKeys.forEach((key) => keys.add(key));
  }
  if (websiteServiceTypes.has(serviceType)) {
    websiteKeys.forEach((key) => keys.add(key));
    technicalKeys.forEach((key) => keys.add(key));
  }
  if (softwareServiceTypes.has(serviceType)) {
    softwareKeys.forEach((key) => keys.add(key));
    technicalKeys.forEach((key) => keys.add(key));
  }
  if (maintenanceServiceTypes.has(serviceType)) {
    maintenanceKeys.forEach((key) => keys.add(key));
    technicalKeys.forEach((key) => keys.add(key));
  }

  return keys;
}

function fieldsByKeys(fields: LeadFlowFormField[], keys: string[]) {
  const keySet = new Set(keys);
  return fields.filter((field) => keySet.has(field.key));
}

function validateFields(fields: LeadFlowFormField[], values: Record<string, unknown>) {
  return Object.fromEntries(
    fields
      .filter((field) => field.required && isMissing(values[field.key]))
      .map((field) => [field.key, 'This field is required.']),
  );
}

function visibleSubmittedValues(fields: LeadFlowFormField[], values: Record<string, unknown>) {
  const visibleKeys = getVisibleKeys(values);
  return Object.fromEntries(
    fields
      .filter((field) => visibleKeys.has(field.key))
      .map((field) => [field.key, values[field.key]])
      .filter(([, value]) => isSerializableValue(value)),
  );
}

function createOnboardingSteps(fields: LeadFlowFormField[], values: Record<string, unknown>) {
  const serviceType = typeof values.serviceType === 'string' ? values.serviceType : '';
  const steps = [
    { title: 'Business', subtitle: 'Your company and primary contact.', fields: fieldsByKeys(fields, businessKeys) },
    { title: 'Project', subtitle: 'Tell us what we are building and why.', fields: fieldsByKeys(fields, projectKeys) },
  ];

  if (!serviceType || websiteServiceTypes.has(serviceType) || softwareServiceTypes.has(serviceType) || serviceType === 'Other') {
    steps.push({ title: 'Brand & Content', subtitle: 'Brand assets, copy, media, and reference material.', fields: fieldsByKeys(fields, brandKeys) });
  }
  if (websiteServiceTypes.has(serviceType)) {
    steps.push({ title: 'Website Setup', subtitle: 'Domain, hosting, pages, SEO, analytics, and integrations.', fields: fieldsByKeys(fields, websiteKeys) });
  }
  if (softwareServiceTypes.has(serviceType)) {
    steps.push({ title: 'App / Software', subtitle: 'Roles, features, dashboards, integrations, and users.', fields: fieldsByKeys(fields, softwareKeys) });
  }
  if (maintenanceServiceTypes.has(serviceType)) {
    steps.push({ title: 'Maintenance', subtitle: 'Existing system details and support needs.', fields: fieldsByKeys(fields, maintenanceKeys) });
  }
  if (websiteServiceTypes.has(serviceType) || softwareServiceTypes.has(serviceType) || maintenanceServiceTypes.has(serviceType)) {
    steps.push({ title: 'Technical Access', subtitle: 'Tell us what access may be needed. Do not share passwords here.', fields: fieldsByKeys(fields, technicalKeys) });
  }

  steps.push({ title: 'Review & Consent', subtitle: 'Final notes and acknowledgement.', fields: fieldsByKeys(fields, finalKeys) });
  return steps.filter((step) => step.fields.length > 0);
}

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
  const [stepIndex, setStepIndex] = useState(0);

  const storageKey = `leadflow-public-form:${params.token}`;
  const isOnboarding = Boolean(
    payload?.form.isCode2CrestOnboarding || payload?.form.systemKey === CODE2CREST_CLIENT_ONBOARDING_SYSTEM_KEY,
  );
  const onboardingSteps = useMemo(
    () => (payload ? createOnboardingSteps(payload.form.fields, values) : []),
    [payload, values],
  );
  const currentStep = onboardingSteps[Math.min(stepIndex, Math.max(onboardingSteps.length - 1, 0))];
  const visibleFields = payload ? payload.form.fields.filter((field) => getVisibleKeys(values).has(field.key)) : [];

  useEffect(() => {
    let mounted = true;
    FormsService.getPublicForm(params.token)
      .then((data) => {
        if (mounted) {
          const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem(storageKey) : null;
          setPayload(data);
          setValues(saved ? ({ ...data.prefill, ...JSON.parse(saved) } as Record<string, unknown>) : data.prefill || {});
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
  }, [params.token, storageKey]);

  useEffect(() => {
    if (!payload || submitted || typeof window === 'undefined') return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(values));
  }, [payload, storageKey, submitted, values]);

  useEffect(() => {
    if (stepIndex >= onboardingSteps.length) {
      setStepIndex(Math.max(onboardingSteps.length - 1, 0));
    }
  }, [onboardingSteps.length, stepIndex]);

  function updateValue(key: string, value: unknown) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
    setValues((current) => ({ ...current, [key]: value }));
  }

  function goNext() {
    if (!currentStep) return;
    const errors = validateFields(currentStep.fields, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStepIndex((current) => Math.min(current + 1, onboardingSteps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const submitFields = isOnboarding ? visibleFields : payload?.form.fields || [];
    const errors = validateFields(submitFields, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please complete the required fields before submitting.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const submittedValues = isOnboarding && payload ? visibleSubmittedValues(payload.form.fields, values) : values;
      await FormsService.submitPublicForm(params.token, submittedValues, website);
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(storageKey);
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
      <div className="mx-auto max-w-5xl">
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
              <p className="mt-2 text-[var(--color-muted)]">
                Your onboarding response has been submitted successfully. The Code2Crest team will review it before kickoff.
              </p>
            </div>
          ) : payload ? (
            <form onSubmit={submit}>
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
                {payload.company.logoUrl && (
                  <Image src={payload.company.logoUrl} alt={payload.company.name} width={64} height={64} className="rounded-xl object-contain" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">{payload.company.name}</p>
                  <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">{payload.form.name}</h1>
                  {payload.form.description && <p className="mt-2 text-[var(--color-muted)]">{payload.form.description}</p>}
                  {isOnboarding && (
                    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <p>
                        Complete this guided onboarding once your project is approved. We prefilled known contact and deal details where possible.
                      </p>
                      <p className="mt-2 font-semibold">Please do not enter passwords, OTPs, banking credentials, or secret API keys.</p>
                    </div>
                  )}
                </div>
              </div>

              <input tabIndex={-1} className="hidden" value={website} onChange={(event) => setWebsite(event.target.value)} autoComplete="off" />

              {isOnboarding && currentStep ? (
                <div>
                  <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {onboardingSteps.map((step, index) => (
                        <button
                          key={step.title}
                          type="button"
                          className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                            index === stepIndex
                              ? 'bg-[var(--color-primary)] text-white'
                              : index < stepIndex
                                ? 'bg-emerald-50 text-emerald-800'
                                : 'bg-[var(--color-bg)] text-[var(--color-muted)]'
                          }`}
                          onClick={() => setStepIndex(index)}
                        >
                          {index + 1}. {step.title}
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                        Step {stepIndex + 1} of {onboardingSteps.length}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-[var(--color-text)]">{currentStep.title}</h2>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{currentStep.subtitle}</p>
                    </div>
                  </div>

                  {currentStep.title === 'Technical Access' && (
                    <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                      Security note: only indicate what access is needed. Code2Crest will share secure instructions separately.
                    </p>
                  )}

                  <FormRenderer
                    fields={currentStep.fields}
                    values={values}
                    errors={fieldErrors}
                    disabled={submitting}
                    layout="grid"
                    onChange={updateValue}
                  />

                  {currentStep.title === 'Review & Consent' && (
                    <div className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white p-5">
                      <h3 className="text-lg font-bold text-[var(--color-text)]">Submission preview</h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {visibleFields
                          .filter((field) => isSerializableValue(values[field.key]))
                          .slice(0, 12)
                          .map((field) => (
                            <div key={field.key} className="rounded-xl bg-[var(--color-bg)] p-3 text-sm">
                              <p className="font-semibold text-[var(--color-muted)]">{field.label}</p>
                              <p className="mt-1 break-words text-[var(--color-text)]">{valueLabel(values[field.key])}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      className="btn-secondary justify-center"
                      disabled={submitting || stepIndex === 0}
                      onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                    >
                      Back
                    </button>
                    {stepIndex === onboardingSteps.length - 1 ? (
                      <button className="btn-primary justify-center" disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit onboarding'}
                      </button>
                    ) : (
                      <button type="button" className="btn-primary justify-center" disabled={submitting} onClick={goNext}>
                        Continue
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <FormRenderer fields={payload.form.fields} values={values} errors={fieldErrors} disabled={submitting} onChange={updateValue} />
                  {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                  <div className="mt-8 flex justify-end">
                    <button className="btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit response'}</button>
                  </div>
                </>
              )}
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
