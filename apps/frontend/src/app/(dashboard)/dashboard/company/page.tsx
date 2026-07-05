"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthService, LeadService } from "@/services";
import type { CompanySettings, User } from "@/types";
import { COUNTRIES, INDIAN_STATES, defaultPhoneCode, isIndia } from "@/utils/billing";

const emptyForm = {
  name: "",
  gstin: "",
  country: "India",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  postalCode: "",
  phoneCountryCode: "+91",
  phone: "",
  email: "",
  website: "",
  logoUrl: "",
  signatureUrl: "",
  quotationTerms: "",
  bankDetails: "",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function settingsToForm(settings: CompanySettings) {
  return {
    name: settings.name || "",
    gstin: settings.gstin || "",
    country: settings.country || "India",
    addressLine1: settings.addressLine1 || "",
    addressLine2: settings.addressLine2 || "",
    city: settings.city || "",
    state: settings.state || "",
    pincode: settings.pincode || "",
    postalCode: settings.postalCode || settings.pincode || "",
    phoneCountryCode: settings.phoneCountryCode || "+91",
    phone: settings.phone || "",
    email: settings.email || "",
    website: settings.website || "",
    logoUrl: settings.logoUrl || "",
    signatureUrl: settings.signatureUrl || "",
    quotationTerms: settings.quotationTerms || "",
    bankDetails: settings.bankDetails || "",
  };
}

function compactAddress(form: typeof emptyForm) {
  return [
    form.addressLine1,
    form.addressLine2,
    [form.city, form.state, form.postalCode || form.pincode].filter(Boolean).join(", "),
    form.country,
  ].filter(Boolean);
}

function resolveAssetUrl(url: string) {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("/")) return `${API_URL.replace(/\/$/, "")}${url}`;
  return url;
}

function CompanyDocumentPreview({ form }: { form: typeof emptyForm }) {
  const address = compactAddress(form);
  const logoUrl = resolveAssetUrl(form.logoUrl);
  const signatureUrl = resolveAssetUrl(form.signatureUrl);
  const contactLine = [
    [form.phoneCountryCode, form.phone].filter(Boolean).join(" "),
    form.email,
    form.website,
  ].filter(Boolean);

  return (
    <aside className="sticky top-6 w-full rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Document Preview
          </p>
          <h2 className="mt-2 truncate text-lg font-bold text-slate-950">
            {form.name || "Company name"}
          </h2>
          {form.gstin && <p className="mt-1 text-xs text-slate-500">GSTIN: {form.gstin}</p>}
        </div>
        <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] text-xs font-semibold text-slate-400">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company logo preview"
              className="max-h-12 max-w-20 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            "Logo"
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From block</p>
          <div className="mt-2 rounded-xl bg-[var(--color-bg)] p-3 text-slate-600">
            {address.length ? (
              address.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p className="text-slate-400">Company address will appear here.</p>
            )}
            {contactLine.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">{contactLine.join(" | ")}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quotation</p>
            <p className="mt-2 text-sm font-bold text-slate-950">Terms</p>
            <p className="mt-1 line-clamp-3 text-xs text-slate-500">
              {form.quotationTerms || "Quotation terms will appear in PDFs."}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
            <p className="mt-2 text-sm font-bold text-slate-950">Payment</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-500">
              {form.bankDetails || "Bank details will appear when available."}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between rounded-xl bg-emerald-50 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Signature</p>
            <p className="mt-1 text-xs text-emerald-700">
              {signatureUrl ? "Signature image configured" : "Authorized signatory line"}
            </p>
          </div>
          {signatureUrl && (
            <img
              src={signatureUrl}
              alt="Signature preview"
              className="max-h-10 max-w-28 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

export default function CompanyPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const isAdmin = currentUser?.role === "ADMIN";

  useEffect(() => {
    setCurrentUser(AuthService.getUser());
  }, []);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const settings = (await LeadService.getCompany()) as CompanySettings;
      setForm(settingsToForm(settings));
    } catch {
      setError("Could not load company settings.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setMutating(true);

    try {
      const settings = (await LeadService.updateCompany(form)) as CompanySettings;
      setForm(settingsToForm(settings));
      setSaved(true);
    } catch {
      setError("Could not save company settings. Check URLs and required fields.");
    } finally {
      setMutating(false);
    }
  }

  function updateCountry(country: string) {
    setForm({
      ...form,
      country,
      phoneCountryCode: !form.phoneCountryCode || form.phoneCountryCode === defaultPhoneCode(form.country)
        ? defaultPhoneCode(country)
        : form.phoneCountryCode,
      state: isIndia(country) ? form.state : "",
      gstin: isIndia(country) ? form.gstin : "",
    });
  }

  async function uploadAsset(kind: "logo" | "signature", file?: File) {
    if (!file) return;
    setError("");
    const allowed = kind === "logo"
      ? ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
      : ["image/png", "image/jpeg", "image/jpg"];
    const maxBytes = kind === "logo" ? 1024 * 1024 : 500 * 1024;

    if (!allowed.includes(file.type)) {
      setError("Invalid file type.");
      return;
    }
    if (file.size > maxBytes) {
      setError("File too large.");
      return;
    }

    setMutating(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await LeadService.uploadCompanyAsset({
        kind,
        fileName: file.name,
        mimeType: file.type,
        data,
      });
      const url = result.url as string;
      setForm(kind === "logo" ? { ...form, logoUrl: url } : { ...form, signatureUrl: url });
    } catch {
      setError("Could not upload file.");
    } finally {
      setMutating(false);
    }
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-red-500">Access denied</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Company settings are admin only.</h1>
          <p className="mt-2 text-slate-500">Ask an admin to update billing and quotation details.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-6 lg:px-6">
      <header>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            Admin Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Company</h1>
          <p className="mt-1 text-slate-500">
            These details appear on quotation PDFs and customer billing documents.
          </p>
        </div>
      </header>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Company settings saved.</p>}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading company settings...</p>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form onSubmit={submit} className="card space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input className="input-field xl:col-span-2" placeholder="Company name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={mutating} />
              <select className="input-field" value={form.country} onChange={(event) => updateCountry(event.target.value)} disabled={mutating}>
                {COUNTRIES.map((country) => <option key={country.name} value={country.name}>{country.name}</option>)}
              </select>
              {isIndia(form.country) && <input className="input-field" placeholder="GSTIN" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} disabled={mutating} />}
              <input className="input-field" placeholder="+91" value={form.phoneCountryCode} onChange={(event) => setForm({ ...form, phoneCountryCode: event.target.value })} disabled={mutating} />
              <input className="input-field" placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} disabled={mutating} />
              <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={mutating} />
              <input className="input-field" type="url" placeholder="Website" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} disabled={mutating} />
              <input className="input-field" placeholder="Logo URL or uploaded path" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} disabled={mutating} />
              <input className="input-field" placeholder="Signature URL or uploaded path" value={form.signatureUrl} onChange={(event) => setForm({ ...form, signatureUrl: event.target.value })} disabled={mutating} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <span className="block font-semibold text-slate-900">Logo upload</span>
                <span className="block text-xs">PNG, JPG, JPEG, SVG. Max 1 MB.</span>
                <input className="mt-3 block w-full text-sm" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" onChange={(event) => uploadAsset("logo", event.target.files?.[0])} disabled={mutating} />
              </label>
              <label className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <span className="block font-semibold text-slate-900">Signature upload</span>
                <span className="block text-xs">PNG, JPG, JPEG. Max 500 KB. Transparent PNG recommended.</span>
                <input className="mt-3 block w-full text-sm" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => uploadAsset("signature", event.target.files?.[0])} disabled={mutating} />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input className="input-field xl:col-span-2" placeholder="Address line 1" value={form.addressLine1} onChange={(event) => setForm({ ...form, addressLine1: event.target.value })} disabled={mutating} />
              <input className="input-field" placeholder="Address line 2" value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} disabled={mutating} />
              <input className="input-field" placeholder="City" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} disabled={mutating} />
              {isIndia(form.country) ? (
                <select className="input-field" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} disabled={mutating}>
                  <option value="">State</option>
                  {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              ) : (
                <input className="input-field" placeholder="State / Province" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} disabled={mutating} />
              )}
              <input className="input-field" placeholder={isIndia(form.country) ? "Pincode" : "Postal Code"} value={form.postalCode || form.pincode} onChange={(event) => setForm({ ...form, postalCode: event.target.value, pincode: event.target.value })} disabled={mutating} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <textarea className="input-field min-h-32" placeholder="Quotation terms" value={form.quotationTerms} onChange={(event) => setForm({ ...form, quotationTerms: event.target.value })} disabled={mutating} />
              <textarea className="input-field min-h-32" placeholder="Bank details" value={form.bankDetails} onChange={(event) => setForm({ ...form, bankDetails: event.target.value })} disabled={mutating} />
            </div>

            <div className="flex justify-end">
              <button className="btn-primary" disabled={mutating}>
                {mutating ? "Saving..." : "Save company settings"}
              </button>
            </div>
          </form>

          <CompanyDocumentPreview form={form} />
        </div>
      )}
    </main>
  );
}
